/**
 * Momentum Decay Job
 * 
 * Background job that recalculates momentum for all leads periodically.
 * This ensures classifications stay accurate as time passes and activity ages.
 * 
 * Schedule: Every hour (or on-demand)
 * 
 * Logic:
 * 1. Query all leads with momentum > 0
 * 2. Recalculate momentum based on current time
 * 3. Update classification if momentum dropped
 * 4. Update classification reason
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { 
  calculateMomentum, 
  getIntelligentClassification, 
  generateClassificationReason 
} from '../utils/momentumCalculator.js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Job configuration
const JOB_CONFIG = {
  BATCH_SIZE: 100,        // Process leads in batches
  MIN_MOMENTUM_TO_CHECK: 1, // Only check leads with some momentum
  LOG_UPDATES: true       // Log classification changes
};

/**
 * Run the momentum decay job
 * @param {Object} options - Job options
 * @param {boolean} options.dryRun - If true, don't save changes
 * @param {number} options.batchSize - Number of leads to process per batch
 * @returns {Object} Job results summary
 */
export async function runMomentumDecayJob(options = {}) {
  const { dryRun = false, batchSize = JOB_CONFIG.BATCH_SIZE } = options;
  const startTime = Date.now();
  
  console.log('🔄 Starting momentum decay job...');
  
  const results = {
    totalProcessed: 0,
    classificationsChanged: 0,
    errorsEncountered: 0,
    leadUpdates: []
  };

  try {
    // Step 1: Get all leads with momentum scores (or all leads for initial calculation)
    const { data: leadsToProcess, error: fetchError } = await supabase
      .from('lead_scores')
      .select(`
        lead_id,
        tenant_id,
        total_score,
        score_classification,
        momentum_score,
        momentum_level
      `)
      .gte('momentum_score', JOB_CONFIG.MIN_MOMENTUM_TO_CHECK)
      .order('momentum_score', { ascending: false })
      .limit(batchSize);

    if (fetchError) {
      throw fetchError;
    }

    if (!leadsToProcess || leadsToProcess.length === 0) {
      console.log('✅ No leads with momentum to process');
      return results;
    }

    console.log(`📊 Processing ${leadsToProcess.length} leads with active momentum...`);

    // Step 2: Process each lead
    for (const leadScore of leadsToProcess) {
      try {
        // Fetch lead's recent activities
        const { data: activities, error: actError } = await supabase
          .from('lead_activities')
          .select('activity_type, activity_subtype, activity_timestamp, created_at')
          .eq('lead_id', leadScore.lead_id)
          .order('created_at', { ascending: false })
          .limit(100);

        if (actError) {
          console.error(`Error fetching activities for lead ${leadScore.lead_id}:`, actError);
          results.errorsEncountered++;
          continue;
        }

        // Step 3: Recalculate momentum with current time
        const newMomentum = calculateMomentum(activities || []);
        
        // Step 4: Get new classification
        const newClassification = getIntelligentClassification(
          leadScore.total_score, 
          newMomentum
        );
        
        // Step 5: Generate new reason
        const newReason = generateClassificationReason({
          score: leadScore.total_score,
          momentum: newMomentum,
          classification: newClassification
        });

        // Check if classification changed
        const classificationChanged = newClassification !== leadScore.score_classification;
        const momentumChanged = newMomentum.score !== leadScore.momentum_score;

        if (classificationChanged || momentumChanged) {
          if (JOB_CONFIG.LOG_UPDATES && classificationChanged) {
            console.log(`📉 Lead ${leadScore.lead_id}: ${leadScore.score_classification} → ${newClassification} (momentum: ${leadScore.momentum_score} → ${newMomentum.score})`);
          }

          results.leadUpdates.push({
            lead_id: leadScore.lead_id,
            oldClassification: leadScore.score_classification,
            newClassification,
            oldMomentum: leadScore.momentum_score,
            newMomentum: newMomentum.score,
            reason: newReason
          });

          if (classificationChanged) {
            results.classificationsChanged++;
          }

          // Step 6: Update database (unless dry run)
          if (!dryRun) {
            const { error: updateError } = await supabase
              .from('lead_scores')
              .update({
                momentum_score: newMomentum.score,
                momentum_level: newMomentum.level,
                actions_last_24h: newMomentum.actionsLast24h,
                actions_last_72h: newMomentum.actionsLast72h,
                score_classification: newClassification,
                classification_reason: newReason,
                surge_detected: newMomentum.surgeDetected,
                momentum_updated_at: new Date().toISOString()
              })
              .eq('lead_id', leadScore.lead_id);

            if (updateError) {
              console.error(`Error updating lead ${leadScore.lead_id}:`, updateError);
              results.errorsEncountered++;
            }
          }
        }

        results.totalProcessed++;
      } catch (leadError) {
        console.error(`Error processing lead ${leadScore.lead_id}:`, leadError);
        results.errorsEncountered++;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Momentum decay job completed in ${duration}s`);
    console.log(`   Processed: ${results.totalProcessed}, Classifications changed: ${results.classificationsChanged}, Errors: ${results.errorsEncountered}`);

    return results;
  } catch (error) {
    console.error('❌ Momentum decay job failed:', error);
    results.errorsEncountered++;
    return results;
  }
}

/**
 * Recalculate momentum for ALL leads (full refresh)
 * Use this when first deploying the momentum system or for periodic full refresh
 */
export async function recalculateAllLeadMomentum(options = {}) {
  const { dryRun = false, batchSize = 50 } = options;
  const startTime = Date.now();
  
  console.log('🔄 Starting full momentum recalculation for all leads...');
  
  let offset = 0;
  let totalProcessed = 0;
  let totalUpdated = 0;

  while (true) {
    // Fetch batch of leads
    const { data: leads, error } = await supabase
      .from('leads')
      .select(`
        lead_id,
        tenant_id,
        lead_scores!inner (
          total_score,
          score_classification
        )
      `)
      .range(offset, offset + batchSize - 1);

    if (error) {
      console.error('Error fetching leads:', error);
      break;
    }

    if (!leads || leads.length === 0) {
      break;
    }

    console.log(`Processing batch: ${offset + 1} to ${offset + leads.length}`);

    for (const lead of leads) {
      try {
        // Fetch activities
        const { data: activities } = await supabase
          .from('lead_activities')
          .select('activity_type, activity_subtype, activity_timestamp, created_at')
          .eq('lead_id', lead.lead_id)
          .order('created_at', { ascending: false })
          .limit(100);

        // Calculate momentum
        const momentum = calculateMomentum(activities || []);
        const totalScore = lead.lead_scores?.total_score || 0;
        const classification = getIntelligentClassification(totalScore, momentum);
        const reason = generateClassificationReason({
          score: totalScore,
          momentum,
          classification
        });

        // Update
        if (!dryRun) {
          await supabase
            .from('lead_scores')
            .update({
              momentum_score: momentum.score,
              momentum_level: momentum.level,
              actions_last_24h: momentum.actionsLast24h,
              actions_last_72h: momentum.actionsLast72h,
              score_classification: classification,
              classification_reason: reason,
              surge_detected: momentum.surgeDetected,
              last_high_intent_action: momentum.lastHighIntentAction,
              momentum_updated_at: new Date().toISOString()
            })
            .eq('lead_id', lead.lead_id);
        }

        totalUpdated++;
      } catch (err) {
        console.error(`Error processing lead ${lead.lead_id}:`, err);
      }

      totalProcessed++;
    }

    offset += batchSize;
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✅ Full momentum recalculation completed in ${duration}s`);
  console.log(`   Total leads processed: ${totalProcessed}, Updated: ${totalUpdated}`);

  return { totalProcessed, totalUpdated };
}

/**
 * Start the momentum decay job on a schedule
 * @param {number} intervalMs - Interval between runs in milliseconds (default: 1 hour)
 */
export function startMomentumDecayScheduler(intervalMs = 60 * 60 * 1000) {
  console.log(`📅 Momentum decay scheduler started (interval: ${intervalMs / 1000}s)`);
  
  // Run immediately on start
  runMomentumDecayJob().catch(console.error);
  
  // Then run on interval
  const intervalId = setInterval(() => {
    runMomentumDecayJob().catch(console.error);
  }, intervalMs);

  return intervalId;
}

/**
 * Stop the momentum decay scheduler
 * @param {number} intervalId - The interval ID returned by startMomentumDecayScheduler
 */
export function stopMomentumDecayScheduler(intervalId) {
  if (intervalId) {
    clearInterval(intervalId);
    console.log('📅 Momentum decay scheduler stopped');
  }
}

export default {
  runMomentumDecayJob,
  recalculateAllLeadMomentum,
  startMomentumDecayScheduler,
  stopMomentumDecayScheduler
};
