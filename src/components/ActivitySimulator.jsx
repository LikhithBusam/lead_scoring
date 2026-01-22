import { useState, useEffect, useCallback } from 'react'
import {
  Eye, FileText, Mail, Calendar, Download,
  Star, TrendingUp, RefreshCw, Zap,
  Globe, Users, BookOpen, Video, Database, Clock, ExternalLink
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
  'cta_click': Zap,
}

// Color mapping for activity types
const activityColorMap = {
  'page_view': 'bg-blue-500',
  'form_submission': 'bg-green-500',
  'content_download': 'bg-purple-500',
  'content_view': 'bg-indigo-500',
  'email_engagement': 'bg-yellow-500',
  'event_registration': 'bg-pink-500',
  'event_attendance': 'bg-red-500',
  'session': 'bg-teal-500',
  'cta_click': 'bg-orange-500',
}

const ActivitySimulator = ({ onActivityTracked, apiKey }) => {
  const [leads, setLeads] = useState([])
  const [selectedLead, setSelectedLead] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activitiesLoading, setActivitiesLoading] = useState(false)
  const [realActivities, setRealActivities] = useState([])
  const [pollingEnabled, setPollingEnabled] = useState(true)

  // Fetch leads on mount
  useEffect(() => {
    fetchLeads()
  }, [])

  // Fetch activities when lead is selected
  useEffect(() => {
    if (selectedLead) {
      fetchLeadActivities(selectedLead.id)
    }
  }, [selectedLead])

  // Poll for new activities every 10 seconds
  useEffect(() => {
    if (!selectedLead || !pollingEnabled) return

    const interval = setInterval(() => {
      fetchLeadActivities(selectedLead.id, true) // silent refresh
    }, 10000)

    return () => clearInterval(interval)
  }, [selectedLead, pollingEnabled])

  const fetchLeads = async () => {
    try {
      const response = await fetch('/api/v1/leads', {
        headers: {
          'X-API-Key': apiKey
        }
      })
      const data = await response.json()
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

  // Fetch real activities from database for selected lead
  const fetchLeadActivities = async (leadId, silent = false) => {
    if (!silent) setActivitiesLoading(true)

    try {
      const response = await fetch(`/api/v1/leads/${leadId}/activities?limit=50`, {
        headers: {
          'X-API-Key': apiKey
        }
      })
      const data = await response.json()

      if (data.success) {
        setRealActivities(data.activities || [])
      } else {
        console.error('Failed to fetch activities:', data.error)
      }
    } catch (error) {
      console.error('Error fetching lead activities:', error)
    } finally {
      if (!silent) setActivitiesLoading(false)
    }
  }

  // Refresh lead data and activities
  const handleRefresh = useCallback(async () => {
    await fetchLeads()
    if (selectedLead) {
      await fetchLeadActivities(selectedLead.id)
    }
  }, [selectedLead])

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

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  // Get activity icon
  const getActivityIcon = (activityType) => {
    return iconMap[activityType] || Star
  }

  // Get activity color
  const getActivityColor = (activityType) => {
    return activityColorMap[activityType] || 'bg-gray-500'
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
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
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
                  <p className="text-sm font-medium text-gray-900 truncate">{lead.company || 'N/A'}</p>
                  <p className="text-xs text-gray-500 truncate">{lead.email}</p>
                </div>
                <div className={`text-lg font-bold ${getScoreColor(lead.score)}`}>
                  {lead.score}
                </div>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className={`px-2 py-0.5 text-xs rounded-full ${getClassificationColor(lead.classification)}`}>
                  {lead.classification?.toUpperCase()}
                </span>
                <span className="text-xs text-gray-400">{lead.activityCount || 0} activities</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lead Details - Center Panel */}
      <div className="col-span-5 bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-gray-900 text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Lead Activity Timeline
          </h3>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
              <input
                type="checkbox"
                checked={pollingEnabled}
                onChange={(e) => setPollingEnabled(e.target.checked)}
                className="rounded"
              />
              Auto-refresh
            </label>
            <button
              onClick={handleRefresh}
              className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
              title="Refresh activities"
            >
              <RefreshCw className={`h-5 w-5 ${activitiesLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {selectedLead ? (
          <>
            {/* Lead Info Header */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Viewing activities for:</p>
                  <p className="text-lg font-semibold text-gray-900">{selectedLead.company || 'N/A'}</p>
                  <p className="text-sm text-gray-500">{selectedLead.email}</p>
                  {/* Classification Reason */}
                  {selectedLead.classificationReason && (
                    <p className="text-xs text-gray-600 mt-2 italic">
                      {selectedLead.classificationReason}
                    </p>
                  )}
                </div>
                <div className="text-center">
                  <div className={`text-4xl font-bold ${getScoreColor(selectedLead.score)}`}>
                    {selectedLead.score}
                  </div>
                  <span className={`inline-block mt-1 px-3 py-1 text-xs rounded-full ${getClassificationColor(selectedLead.classification)}`}>
                    {selectedLead.classification?.toUpperCase()}
                  </span>
                  {/* Momentum indicator */}
                  {selectedLead.momentum?.level && selectedLead.momentum.level !== 'none' && (
                    <div className={`text-xs mt-1 ${
                      selectedLead.momentum.level === 'high' ? 'text-red-500' :
                      selectedLead.momentum.level === 'medium' ? 'text-orange-500' : 'text-yellow-500'
                    }`}>
                      ⚡ {selectedLead.momentum.level.toUpperCase()} momentum
                    </div>
                  )}
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

              {/* Momentum Stats */}
              {selectedLead.momentum && (
                <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                  <div className="bg-white rounded-lg p-2">
                    <div className="text-sm font-semibold text-purple-600">{selectedLead.momentum.score || 0}</div>
                    <div className="text-xs text-gray-500">Momentum</div>
                  </div>
                  <div className="bg-white rounded-lg p-2">
                    <div className="text-sm font-semibold text-gray-700">{selectedLead.momentum.actionsLast24h || 0}</div>
                    <div className="text-xs text-gray-500">24h</div>
                  </div>
                  <div className="bg-white rounded-lg p-2">
                    <div className="text-sm font-semibold text-gray-700">{selectedLead.momentum.actionsLast72h || 0}</div>
                    <div className="text-xs text-gray-500">72h</div>
                  </div>
                  <div className="bg-white rounded-lg p-2">
                    <div className="text-sm font-semibold text-gray-700">
                      {selectedLead.momentum.surgeDetected ? '🔥 Yes' : 'No'}
                    </div>
                    <div className="text-xs text-gray-500">Surge</div>
                  </div>
                </div>
              )}
            </div>

            {/* Activity Timeline */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                <Database className="h-4 w-4" />
                <span>Real activities from all websites ({realActivities.length} total)</span>
              </div>

              {activitiesLoading ? (
                <div className="text-center py-8 text-gray-500">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                  Loading activities...
                </div>
              ) : realActivities.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Globe className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No activities tracked yet</p>
                  <p className="text-xs mt-1">Activities will appear here when the lead visits your websites</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {realActivities.map((activity, index) => {
                    const Icon = getActivityIcon(activity.type)
                    const color = getActivityColor(activity.type)

                    return (
                      <div
                        key={activity.id || index}
                        className="flex gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className={`p-2 rounded-lg ${color} flex-shrink-0`}>
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {activity.subtype ?
                                  activity.subtype.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) :
                                  activity.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                                }
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {activity.type.replace(/_/g, ' ')}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <span className="text-sm font-semibold text-green-600">
                                +{activity.points || 0} pts
                              </span>
                            </div>
                          </div>

                          {activity.pageUrl && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-blue-600">
                              <ExternalLink className="h-3 w-3" />
                              <span className="truncate max-w-[200px]" title={activity.pageUrl}>
                                {activity.pageUrl}
                              </span>
                            </div>
                          )}

                          <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                            <Clock className="h-3 w-3" />
                            <span>{formatTimestamp(activity.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center text-gray-500 py-12">
            Select a lead from the left panel to view their activity
          </div>
        )}
      </div>

      {/* Activity Summary - Right Panel */}
      <div className="col-span-4 bg-white rounded-lg shadow-md p-4">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Activity Summary
        </h3>

        {selectedLead && realActivities.length > 0 ? (
          <div className="space-y-4">
            {/* Activity Type Breakdown */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">By Activity Type</h4>
              <div className="space-y-2">
                {Object.entries(
                  realActivities.reduce((acc, activity) => {
                    const type = activity.type || 'unknown'
                    if (!acc[type]) {
                      acc[type] = { count: 0, points: 0 }
                    }
                    acc[type].count++
                    acc[type].points += activity.points || 0
                    return acc
                  }, {})
                ).sort((a, b) => b[1].count - a[1].count).map(([type, data]) => {
                  const Icon = getActivityIcon(type)
                  const color = getActivityColor(type)

                  return (
                    <div key={type} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded ${color}`}>
                          <Icon className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-sm text-gray-700">
                          {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium text-gray-900">{data.count}x</span>
                        <span className="text-xs text-green-600 ml-2">+{data.points} pts</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Total Points */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Total Behavioral Points</span>
                <span className="text-lg font-bold text-green-600">
                  +{realActivities.reduce((sum, a) => sum + (a.points || 0), 0)} pts
                </span>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Most Recent</h4>
              {realActivities.slice(0, 3).map((activity, i) => (
                <div key={i} className="text-xs text-gray-500 py-1 border-b border-gray-100 last:border-0">
                  <span className="font-medium text-gray-700">
                    {activity.subtype || activity.type}
                  </span>
                  <span className="float-right">{formatTimestamp(activity.timestamp)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-400 py-8">
            <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No activity data</p>
            <p className="text-xs mt-1">Select a lead to view their activity summary</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ActivitySimulator
