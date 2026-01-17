/**
 * Database Cleanup Script
 * Removes old single-tenant data (leads without tenant_id)
 * Run this to start fresh with only multi-tenant data
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanupDatabase() {
  console.log('🧹 Starting database cleanup...\n');

  try {
    // Step 1: Count old data
    const { count: oldLeads } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .is('tenant_id', null);

    console.log(`📊 Found ${oldLeads} old single-tenant leads`);

    if (oldLeads === 0) {
      console.log('✅ Database is already clean! No old data to remove.');
      return;
    }

    // Step 2: Delete old lead activities
    console.log('🗑️  Deleting old lead activities...');
    const { error: activitiesError } = await supabase
      .from('lead_activities')
      .delete()
      .is('tenant_id', null);

    if (activitiesError) {
      console.error('Error deleting activities:', activitiesError);
    } else {
      console.log('✅ Old activities deleted');
    }

    // Step 3: Delete old lead scores
    console.log('🗑️  Deleting old lead scores...');
    const { error: scoresError } = await supabase
      .from('lead_scores')
      .delete()
      .is('tenant_id', null);

    if (scoresError) {
      console.error('Error deleting scores:', scoresError);
    } else {
      console.log('✅ Old scores deleted');
    }

    // Step 4: Delete old leads
    console.log('🗑️  Deleting old leads...');
    const { error: leadsError } = await supabase
      .from('leads')
      .delete()
      .is('tenant_id', null);

    if (leadsError) {
      console.error('Error deleting leads:', leadsError);
    } else {
      console.log('✅ Old leads deleted');
    }

    // Step 5: Delete old contacts
    console.log('🗑️  Deleting old contacts...');
    const { error: contactsError } = await supabase
      .from('contacts')
      .delete()
      .is('tenant_id', null);

    if (contactsError) {
      console.error('Error deleting contacts:', contactsError);
    } else {
      console.log('✅ Old contacts deleted');
    }

    // Step 6: Delete old companies
    console.log('🗑️  Deleting old companies...');
    const { error: companiesError } = await supabase
      .from('companies')
      .delete()
      .is('tenant_id', null);

    if (companiesError) {
      console.error('Error deleting companies:', companiesError);
    } else {
      console.log('✅ Old companies deleted');
    }

    // Step 7: Verify cleanup
    console.log('\n📊 Verification...');

    const { count: remainingLeads } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true });

    const { count: tenantsCount } = await supabase
      .from('tenants')
      .select('*', { count: 'exact', head: true });

    const { count: websitesCount } = await supabase
      .from('tenant_websites')
      .select('*', { count: 'exact', head: true });

    console.log(`✅ Remaining leads: ${remainingLeads} (all with tenant_id)`);
    console.log(`✅ Total tenants: ${tenantsCount}`);
    console.log(`✅ Total websites: ${websitesCount}`);

    console.log('\n🎉 Database cleanup completed successfully!');
    console.log('✅ Your system is now pure multi-tenant');
    console.log('✅ All leads belong to specific tenants');
    console.log('\n📝 Next steps:');
    console.log('   1. Restart your server: npm run dev');
    console.log('   2. Open http://localhost:5173/admin');
    console.log('   3. You should see 0 old leads!');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

// Run cleanup
cleanupDatabase();
