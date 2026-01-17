import { useState } from 'react'
import { Search, Filter, Download, RefreshCw, Zap } from 'lucide-react'
import LeadDetailModal from './LeadDetailModal'

const LeadsList = ({ leads, onLeadUpdate, onRefresh, onTrackActivity, onRecalculateScore }) => {
  const [selectedLead, setSelectedLead] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterClassification, setFilterClassification] = useState('all')
  const [recalculatingId, setRecalculatingId] = useState(null)

  // Filter leads based on search and classification
  const filteredLeads = leads.filter(lead => {
    const matchesSearch =
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.company.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesFilter =
      filterClassification === 'all' ||
      lead.classification === filterClassification

    return matchesSearch && matchesFilter
  })

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

            <button className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{leads.length}</div>
            <div className="text-xs text-gray-600">Total Leads</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {leads.filter(l => l.classification === 'hot').length}
            </div>
            <div className="text-xs text-gray-600">Hot</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {leads.filter(l => l.classification === 'warm').length}
            </div>
            <div className="text-xs text-gray-600">Warm</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {leads.filter(l => l.classification === 'qualified').length}
            </div>
            <div className="text-xs text-gray-600">Qualified</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {leads.filter(l => l.classification === 'cold').length}
            </div>
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
                  <div className="text-sm font-medium text-gray-900">{lead.name}</div>
                  <div className="text-sm text-gray-500">{lead.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{lead.company}</div>
                  <div className="text-sm text-gray-500">{lead.companySize} employees</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{lead.jobTitle}</div>
                  <div className="text-sm text-gray-500">{lead.industry}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getClassificationColor(lead.classification)}`}>
                    {lead.classification.toUpperCase()}
                  </span>
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
        />
      )}
    </div>
  )
}

export default LeadsList
