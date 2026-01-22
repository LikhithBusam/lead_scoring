import { useState, useMemo, useCallback } from 'react'
import { Search, Filter, Download, RefreshCw, Zap, TrendingUp, Activity, FileSpreadsheet, FileText } from 'lucide-react'
import LeadDetailModal from './LeadDetailModal'

// Export leads to CSV
const exportToCSV = (leads, filename = 'leads_export.csv') => {
  const headers = [
    'ID', 'Name', 'Email', 'Phone', 'Company', 'Job Title', 'Industry',
    'Score', 'Classification', 'Momentum Level', 'Source', 'Status',
    'Last Activity', 'Created At'
  ]

  const csvRows = [
    headers.join(','),
    ...leads.map(lead => [
      lead.id,
      `"${(lead.name || '').replace(/"/g, '""')}"`,
      `"${(lead.email || '').replace(/"/g, '""')}"`,
      `"${(lead.phone || '').replace(/"/g, '""')}"`,
      `"${(lead.company || '').replace(/"/g, '""')}"`,
      `"${(lead.jobTitle || '').replace(/"/g, '""')}"`,
      `"${(lead.industry || '').replace(/"/g, '""')}"`,
      lead.score || 0,
      lead.classification || '',
      lead.momentum?.level || 'none',
      lead.source || '',
      lead.status || '',
      lead.lastActivity ? new Date(lead.lastActivity).toISOString() : '',
      lead.createdAt ? new Date(lead.createdAt).toISOString() : ''
    ].join(','))
  ]

  const csvContent = csvRows.join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

// Export leads to JSON
const exportToJSON = (leads, filename = 'leads_export.json') => {
  const exportData = leads.map(lead => ({
    id: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    company: lead.company,
    jobTitle: lead.jobTitle,
    industry: lead.industry,
    score: lead.score,
    classification: lead.classification,
    momentum: lead.momentum,
    scoreBreakdown: lead.scoreBreakdown,
    source: lead.source,
    status: lead.status,
    lastActivity: lead.lastActivity,
    createdAt: lead.createdAt
  }))

  const jsonContent = JSON.stringify(exportData, null, 2)
  const blob = new Blob([jsonContent], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

const LeadsList = ({ leads, onLeadUpdate, onRefresh, onTrackActivity, onRecalculateScore, apiKey }) => {
  const [selectedLead, setSelectedLead] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterClassification, setFilterClassification] = useState('all')
  const [recalculatingId, setRecalculatingId] = useState(null)
  const [showExportMenu, setShowExportMenu] = useState(false)

  // Memoize filtered leads to avoid recalculation on every render
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const matchesSearch =
        lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.company.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesFilter =
        filterClassification === 'all' ||
        lead.classification === filterClassification

      return matchesSearch && matchesFilter
    })
  }, [leads, searchTerm, filterClassification])

  // Memoize stats to avoid recalculating 5 filter operations on every render
  const stats = useMemo(() => ({
    total: leads.length,
    hot: leads.filter(l => l.classification === 'hot').length,
    warm: leads.filter(l => l.classification === 'warm').length,
    qualified: leads.filter(l => l.classification === 'qualified').length,
    cold: leads.filter(l => l.classification === 'cold').length
  }), [leads])

  // Get classification badge color
  const getClassificationColor = (classification) => {
    switch (classification) {
      case 'hot':
        return 'bg-red-100 text-red-800'
      case 'warm':
        return 'bg-orange-100 text-orange-800'
      case 'qualified':
        return 'bg-yellow-100 text-yellow-800'
      case 'cold':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Get momentum indicator color
  const getMomentumColor = (level) => {
    switch (level) {
      case 'high':
        return 'text-red-500'
      case 'medium':
        return 'text-orange-500'
      case 'low':
        return 'text-yellow-500'
      default:
        return 'text-gray-300'
    }
  }

  // Get score color
  const getScoreColor = (score) => {
    if (score >= 80) return 'text-red-600 font-bold'
    if (score >= 60) return 'text-orange-600 font-semibold'
    if (score >= 40) return 'text-yellow-600 font-medium'
    if (score >= 20) return 'text-blue-600'
    return 'text-gray-600'
  }

  // Handle recalculate score
  const handleRecalculateScore = async (e, leadId) => {
    e.stopPropagation()
    if (!onRecalculateScore) return

    setRecalculatingId(leadId)
    try {
      await onRecalculateScore(leadId)
    } catch (error) {
      console.error('Failed to recalculate score:', error)
    } finally {
      setRecalculatingId(null)
    }
  }

  return (
    <div className="bg-white shadow-md rounded-lg">
      {/* Header with Actions */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filter and Actions */}
          <div className="flex gap-2">
            <select
              value={filterClassification}
              onChange={(e) => setFilterClassification(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Leads</option>
              <option value="hot">Hot</option>
              <option value="warm">Warm</option>
              <option value="qualified">Qualified</option>
              <option value="cold">Cold</option>
              <option value="unqualified">Unqualified</option>
            </select>

            <button
              onClick={onRefresh}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>

            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                  <button
                    onClick={() => {
                      exportToCSV(filteredLeads, `leads_${new Date().toISOString().split('T')[0]}.csv`)
                      setShowExportMenu(false)
                    }}
                    className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Export as CSV
                  </button>
                  <button
                    onClick={() => {
                      exportToJSON(filteredLeads, `leads_${new Date().toISOString().split('T')[0]}.json`)
                      setShowExportMenu(false)
                    }}
                    className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    Export as JSON
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats Summary - Using memoized stats */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-xs text-gray-600">Total Leads</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{stats.hot}</div>
            <div className="text-xs text-gray-600">Hot</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.warm}</div>
            <div className="text-xs text-gray-600">Warm</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.qualified}</div>
            <div className="text-xs text-gray-600">Qualified</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.cold}</div>
            <div className="text-xs text-gray-600">Cold</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Lead Score
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Company
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Classification
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Source
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Activity
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredLeads.map((lead) => (
              <tr
                key={lead.id}
                onClick={() => setSelectedLead(lead)}
                className="hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className={`text-2xl ${getScoreColor(lead.score)}`}>
                      {lead.score}
                    </div>
                    {onRecalculateScore && (
                      <button
                        onClick={(e) => handleRecalculateScore(e, lead.id)}
                        disabled={recalculatingId === lead.id}
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Recalculate score"
                      >
                        <Zap className={`h-4 w-4 ${recalculatingId === lead.id ? 'animate-pulse text-blue-500' : ''}`} />
                      </button>
                    )}
                  </div>
                  {lead.lastScoreUpdate && (
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(lead.lastScoreUpdate).toLocaleTimeString()}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {lead.name && lead.name !== 'N/A' ? lead.name : (
                      <span className="text-gray-400 italic">
                        {lead.email?.split('@')[0] || 'Unknown'}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">{lead.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {lead.company && lead.company !== 'N/A' ? lead.company : (
                      <span className="text-gray-400 italic">
                        {lead.email?.split('@')[1]?.split('.')[0].charAt(0).toUpperCase() + lead.email?.split('@')[1]?.split('.')[0].slice(1) || 'Unknown'}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">{lead.companySize} employees</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{lead.jobTitle}</div>
                  <div className="text-sm text-gray-500">{lead.industry}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getClassificationColor(lead.classification)}`}>
                      {lead.classification?.toUpperCase() || 'N/A'}
                    </span>
                    {/* Momentum indicator */}
                    {lead.momentum?.level && lead.momentum.level !== 'none' && (
                      <TrendingUp 
                        className={`h-4 w-4 ${getMomentumColor(lead.momentum.level)}`}
                        title={`Momentum: ${lead.momentum.level} (${lead.momentum.actionsLast24h || 0} actions today)`}
                      />
                    )}
                    {/* Surge indicator */}
                    {lead.momentum?.surgeDetected && (
                      <Activity 
                        className="h-4 w-4 text-red-500 animate-pulse"
                        title="Activity surge detected!"
                      />
                    )}
                  </div>
                  {/* Classification reason */}
                  {lead.classificationReason && (
                    <div className="text-xs text-gray-500 mt-1 max-w-xs truncate" title={lead.classificationReason}>
                      {lead.classificationReason}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {lead.source}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(lead.lastActivity).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredLeads.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No leads found</p>
          </div>
        )}
      </div>

      {/* Lead Detail Modal */}
      {selectedLead && (
        <LeadDetailModal
          lead={leads.find(l => l.id === selectedLead.id) || selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={onLeadUpdate}
          onTrackActivity={onTrackActivity}
          onRecalculateScore={onRecalculateScore}
          apiKey={apiKey}
        />
      )}
    </div>
  )
}

export default LeadsList
