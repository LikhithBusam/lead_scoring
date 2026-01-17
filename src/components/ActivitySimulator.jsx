import { useState, useEffect } from 'react'
import {
  Eye, FileText, Mail, Calendar, Download, ShoppingCart,
  MessageSquare, Phone, Star, TrendingUp, RefreshCw, Zap,
  Globe, DollarSign, Users, BookOpen, Video, Send, Database
} from 'lucide-react'

// Icon mapping for activity types
const iconMap = {
  'page_view': Eye,
  'form_submission': FileText,
  'content_download': Download,
  'content_view': BookOpen,
  'email_engagement': Mail,
  'event_registration': Calendar,
  'event_attendance': Video,
  'session': Globe,
}

// Color mapping for intent levels
const intentColorMap = {
  'high': 'bg-red-500',
  'medium': 'bg-orange-500',
  'low': 'bg-blue-500',
}

const ActivitySimulator = ({ onActivityTracked, apiKey }) => {
  const [leads, setLeads] = useState([])
  const [selectedLead, setSelectedLead] = useState(null)
  const [loading, setLoading] = useState(true)
  const [trackingActivity, setTrackingActivity] = useState(null)
  const [activityLog, setActivityLog] = useState([])
  const [scoreAnimation, setScoreAnimation] = useState(null)
  const [behavioralRules, setBehavioralRules] = useState([])
  const [rulesLoading, setRulesLoading] = useState(true)

  // Fetch leads on mount
  useEffect(() => {
    fetchLeads()
    fetchScoringRules()
  }, [])

  const fetchLeads = async () => {
    try {
      // Use multi-tenant API with API key authentication
      const response = await fetch('/api/v1/leads', {
        headers: {
          'X-API-Key': apiKey || 'lsk_2d91cf1664597e572e0cf054c820fa32992ea8ee0b27bcd7b2e96ee89121a7d9'
        }
      })
      const data = await response.json()
      // Multi-tenant API returns {success, leads: [...]}
      const leadsArray = data.leads || []
      setLeads(leadsArray)
      if (leadsArray.length > 0 && !selectedLead) {
        setSelectedLead(leadsArray[0])
      }
    } catch (error) {
      console.error('Error fetching leads:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch scoring rules from database
  const fetchScoringRules = async () => {
    try {
      // Include API key for authentication
      const response = await fetch('/api/scoring-rules', {
        headers: {
          'X-API-Key': apiKey || 'lsk_2d91cf1664597e572e0cf054c820fa32992ea8ee0b27bcd7b2e96ee89121a7d9'
        }
      })
      const data = await response.json()
      setBehavioralRules(data.behavioral || [])
    } catch (error) {
      console.error('Error fetching scoring rules:', error)
    } finally {
      setRulesLoading(false)
    }
  }

  // Group behavioral rules by activity_type
  const groupedActivities = behavioralRules.reduce((acc, rule) => {
    const category = rule.activity_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push({
      type: rule.activity_type,
      subtype: rule.activity_subtype,
      label: rule.rule_name,
      points: `+${rule.base_points}`,
      basePoints: rule.base_points,
      intentLevel: rule.intent_level,
      icon: iconMap[rule.activity_type] || Star,
      color: intentColorMap[rule.intent_level] || 'bg-gray-500'
    })
    return acc
  }, {})

  // Track activity
  const trackActivity = async (activity) => {
    if (!selectedLead) return

    setTrackingActivity(activity.type + '_' + activity.subtype)

    try {
      const response = await fetch('/api/track-activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey || 'lsk_2d91cf1664597e572e0cf054c820fa32992ea8ee0b27bcd7b2e96ee89121a7d9'
        },
        body: JSON.stringify({
          leadId: selectedLead.id,
          activityType: activity.type,
          activitySubtype: activity.subtype,
          metadata: {
            title: activity.label,
            timestamp: new Date().toISOString(),
            device: 'desktop',
            source: 'simulator'
          }
        })
      })

      const data = await response.json()

      if (data.success) {
        // Calculate score change
        const oldScore = selectedLead.score
        const newScore = data.newScore
        const scoreDiff = newScore - oldScore

        // Update selected lead with new score
        setSelectedLead(prev => ({
          ...prev,
          score: data.newScore,
          classification: data.classification,
          scoreBreakdown: data.breakdown
        }))

        // Update leads list
        setLeads(prev => prev.map(l =>
          l.id === selectedLead.id
            ? { ...l, score: data.newScore, classification: data.classification, scoreBreakdown: data.breakdown }
            : l
        ))

        // Show score animation
        setScoreAnimation({ diff: scoreDiff, points: activity.points })
        setTimeout(() => setScoreAnimation(null), 2000)

        // Add to activity log
        setActivityLog(prev => [{
          id: Date.now(),
          activity: activity.label,
          points: activity.points,
          newScore: data.newScore,
          classification: data.classification,
          timestamp: new Date().toLocaleTimeString()
        }, ...prev].slice(0, 10))

        // Notify parent
        if (onActivityTracked) {
          onActivityTracked(selectedLead.id, data)
        }
      }
    } catch (error) {
      console.error('Error tracking activity:', error)
    } finally {
      setTrackingActivity(null)
    }
  }

  // Get classification color
  const getClassificationColor = (classification) => {
    switch (classification) {
      case 'hot': return 'bg-red-500 text-white'
      case 'warm': return 'bg-orange-500 text-white'
      case 'qualified': return 'bg-yellow-500 text-white'
      case 'cold': return 'bg-blue-500 text-white'
      default: return 'bg-gray-500 text-white'
    }
  }

  // Get score color
  const getScoreColor = (score) => {
    if (score >= 80) return 'text-red-600'
    if (score >= 60) return 'text-orange-600'
    if (score >= 40) return 'text-yellow-600'
    if (score >= 20) return 'text-blue-600'
    return 'text-gray-600'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Lead Selector - Left Panel */}
      <div className="col-span-3 bg-white rounded-lg shadow-md p-4">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Users className="h-5 w-5" />
          Select Lead
        </h3>
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {leads.map(lead => (
            <div
              key={lead.id}
              onClick={() => setSelectedLead(lead)}
              className={`p-3 rounded-lg cursor-pointer transition-all ${selectedLead?.id === lead.id
                ? 'bg-blue-50 border-2 border-blue-500'
                : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{lead.company}</p>
                  <p className="text-xs text-gray-500 truncate">{lead.email}</p>
                </div>
                <div className={`text-lg font-bold ${getScoreColor(lead.score)}`}>
                  {lead.score}
                </div>
              </div>
              <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${getClassificationColor(lead.classification)}`}>
                {lead.classification?.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Activity Simulator - Center Panel */}
      <div className="col-span-6 bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-gray-900 text-lg flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Website Activity Simulator
          </h3>
          <button
            onClick={fetchLeads}
            className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
            title="Refresh leads"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>

        {selectedLead ? (
          <>
            {/* Current Lead Info */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Simulating activity for:</p>
                  <p className="text-lg font-semibold text-gray-900">{selectedLead.company}</p>
                  <p className="text-sm text-gray-500">{selectedLead.email}</p>
                </div>
                <div className="text-center relative">
                  <div className={`text-4xl font-bold ${getScoreColor(selectedLead.score)} transition-all`}>
                    {selectedLead.score}
                    {scoreAnimation && (
                      <span className="absolute -top-2 -right-8 text-lg text-green-500 animate-bounce">
                        {scoreAnimation.points}
                      </span>
                    )}
                  </div>
                  <span className={`inline-block mt-1 px-3 py-1 text-xs rounded-full ${getClassificationColor(selectedLead.classification)}`}>
                    {selectedLead.classification?.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Score Breakdown */}
              {selectedLead.scoreBreakdown && (
                <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                  <div className="bg-white rounded-lg p-2">
                    <div className="text-lg font-semibold text-blue-600">{selectedLead.scoreBreakdown.demographic}</div>
                    <div className="text-xs text-gray-500">Demographic</div>
                  </div>
                  <div className="bg-white rounded-lg p-2">
                    <div className="text-lg font-semibold text-green-600">{selectedLead.scoreBreakdown.behavioral}</div>
                    <div className="text-xs text-gray-500">Behavioral</div>
                  </div>
                  <div className="bg-white rounded-lg p-2">
                    <div className="text-lg font-semibold text-red-600">{selectedLead.scoreBreakdown.negative}</div>
                    <div className="text-xs text-gray-500">Negative</div>
                  </div>
                </div>
              )}
            </div>

            {/* Activity Buttons - From Database */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                <Database className="h-4 w-4" />
                <span>Rules loaded from database ({behavioralRules.length} rules)</span>
                <button
                  onClick={fetchScoringRules}
                  className="text-blue-500 hover:underline"
                >
                  Refresh
                </button>
              </div>

              {rulesLoading ? (
                <div className="text-center py-8 text-gray-500">Loading rules from database...</div>
              ) : Object.keys(groupedActivities).length === 0 ? (
                <div className="text-center py-8 text-gray-500">No behavioral rules found in database</div>
              ) : (
                Object.entries(groupedActivities).map(([category, activities]) => (
                  <div key={category}>
                    <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                      {category}
                      <span className="text-xs text-gray-400">({activities.length} rules)</span>
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      {activities.map(activity => {
                        const Icon = activity.icon
                        const isTracking = trackingActivity === activity.type + '_' + activity.subtype

                        return (
                          <button
                            key={activity.type + '_' + activity.subtype}
                            onClick={() => trackActivity(activity)}
                            disabled={isTracking}
                            className={`flex items-center gap-3 p-3 rounded-lg border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all ${isTracking ? 'opacity-50 cursor-wait' : ''
                              }`}
                          >
                            <div className={`p-2 rounded-lg ${activity.color}`}>
                              <Icon className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1 text-left">
                              <p className="text-sm font-medium text-gray-900 truncate" title={activity.label}>
                                {activity.label}
                              </p>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-green-600 font-semibold">{activity.points} pts</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${activity.intentLevel === 'high' ? 'bg-red-100 text-red-700' :
                                  activity.intentLevel === 'medium' ? 'bg-orange-100 text-orange-700' :
                                    'bg-blue-100 text-blue-700'
                                  }`}>
                                  {activity.intentLevel}
                                </span>
                              </div>
                            </div>
                            {isTracking && (
                              <Zap className="h-5 w-5 text-yellow-500 animate-pulse" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="text-center text-gray-500 py-12">
            Select a lead from the left panel to simulate activity
          </div>
        )}
      </div>

      {/* Activity Log - Right Panel */}
      <div className="col-span-3 bg-white rounded-lg shadow-md p-4">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Activity Log
        </h3>

        {activityLog.length > 0 ? (
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {activityLog.map(log => (
              <div key={log.id} className="bg-gray-50 rounded-lg p-3 border-l-4 border-green-500">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900">{log.activity}</p>
                  <span className="text-xs text-green-600 font-semibold">{log.points}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getClassificationColor(log.classification)}`}>
                    {log.classification?.toUpperCase()}
                  </span>
                  <span className="text-xs text-gray-500">{log.timestamp}</span>
                </div>
                <div className="text-right mt-1">
                  <span className={`text-lg font-bold ${getScoreColor(log.newScore)}`}>
                    Score: {log.newScore}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-400 py-8">
            <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No activities yet</p>
            <p className="text-xs">Click buttons to simulate activity</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ActivitySimulator
