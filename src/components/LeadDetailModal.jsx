import { useState, useMemo } from 'react'
import { X, Save, Search, TrendingUp, TrendingDown, FileText } from 'lucide-react'

const LeadDetailModal = ({ lead, onClose, onUpdate }) => {
  const [formData, setFormData] = useState({ ...lead })
  const [showResearchModal, setShowResearchModal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [researchReport, setResearchReport] = useState(null)
  const [isResearching, setIsResearching] = useState(false)
  const [researchError, setResearchError] = useState(null)
  const [activeSection, setActiveSection] = useState('Company Overview')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onUpdate(formData)
      onClose()
    } catch (error) {
      console.error('Error saving lead:', error)
      alert('Failed to save lead')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCompanyResearch = async () => {
    setIsResearching(true)
    setResearchError(null)
    setShowResearchModal(true)

    try {
      // Extract email domain from lead email
      const emailDomain = formData.email ? formData.email.split('@')[1] : null

      const response = await fetch('/api/company-research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName: formData.company,
          companyWebsite: null, // Can be added if available
          emailDomain: emailDomain
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate research')
      }

      setResearchReport(data.report)
    } catch (error) {
      console.error('Research error:', error)
      setResearchError(error.message)
    } finally {
      setIsResearching(false)
    }
  }

  const getClassificationColor = (classification) => {
    switch (classification) {
      case 'hot': return 'bg-red-100 text-red-800 border-red-200'
      case 'warm': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'qualified': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'cold': return 'bg-blue-100 text-blue-800 border-blue-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <>
      {/* Main Modal */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{formData.name}</h2>
              <p className="text-sm text-gray-600">{formData.company}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Lead Score Section */}
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Total Score */}
              <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Lead Score (Auto-Calculated)</div>
                <div className="text-4xl font-bold text-blue-600">{formData.score}</div>
                <div className={`mt-2 px-3 py-1 inline-flex text-xs font-semibold rounded-full border ${getClassificationColor(formData.classification)}`}>
                  {formData.classification?.toUpperCase()}
                </div>
              </div>

              {/* Score Breakdown */}
              {formData.scoreBreakdown && (
                <>
                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-gray-600">Demographic Score</div>
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formData.scoreBreakdown.demographic}
                      <span className="text-sm text-gray-500 ml-1">/ 50</span>
                    </div>
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${(formData.scoreBreakdown.demographic / 50) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-gray-600">Behavioral Score</div>
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formData.scoreBreakdown.behavioral}
                      <span className="text-sm text-gray-500 ml-1">/ 100</span>
                    </div>
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all"
                        style={{ width: `${(formData.scoreBreakdown.behavioral / 100) * 100}%` }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Negative Scoring Info */}
            {formData.scoreBreakdown?.negative < 0 && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-600" />
                <span className="text-sm text-red-700">
                  Negative Score: {formData.scoreBreakdown.negative} points (due to inactivity or disqualifying factors)
                </span>
              </div>
            )}
          </div>

          {/* Form Content */}
          <div className="px-6 py-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Contact Information */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Job Title *
                </label>
                <input
                  type="text"
                  name="jobTitle"
                  value={formData.jobTitle}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Company Information */}
              <div className="md:col-span-2">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center justify-between">
                  Company Information
                  <button
                    type="button"
                    onClick={handleCompanyResearch}
                    disabled={isResearching}
                    className="px-4 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Search className="h-4 w-4" />
                    {isResearching ? 'Researching...' : 'Company Research'}
                  </button>
                </h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Industry *
                </label>
                <select
                  name="industry"
                  value={formData.industry}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select Industry</option>
                  <option value="Technology">Technology</option>
                  <option value="Finance">Finance</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Manufacturing">Manufacturing</option>
                  <option value="Retail">Retail</option>
                  <option value="Education">Education</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Size *
                </label>
                <select
                  name="companySize"
                  value={formData.companySize}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select Size</option>
                  <option value="1-10">1-10 employees</option>
                  <option value="11-50">11-50 employees</option>
                  <option value="51-200">51-200 employees</option>
                  <option value="201-500">201-500 employees</option>
                  <option value="501-1000">501-1000 employees</option>
                  <option value="1001+">1001+ employees</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Annual Revenue
                </label>
                <select
                  name="revenue"
                  value={formData.revenue}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select Revenue</option>
                  <option value="< 1 Cr">&lt; 1 Crore</option>
                  <option value="1-10 Cr">1-10 Crore</option>
                  <option value="10-50 Cr">10-50 Crore</option>
                  <option value="50-100 Cr">50-100 Crore</option>
                  <option value="100-500 Cr">100-500 Crore</option>
                  <option value="500+ Cr">500+ Crore</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location *
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Budget Authority
                </label>
                <select
                  name="authority"
                  value={formData.authority}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select Authority</option>
                  <option value="Final Decision Maker">Final Decision Maker</option>
                  <option value="Recommender">Recommender</option>
                  <option value="Influencer">Influencer</option>
                  <option value="No Authority">No Authority</option>
                </select>
              </div>

              {/* Lead Source & Campaign */}
              <div className="md:col-span-2">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Lead Source</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Source
                </label>
                <input
                  type="text"
                  name="source"
                  value={formData.source}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Campaign
                </label>
                <input
                  type="text"
                  name="campaign"
                  value={formData.campaign}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Activity Summary */}
              {formData.activities && formData.activities.length > 0 && (
                <div className="md:col-span-2">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Recent Activities</h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    {formData.activities.map((activity, index) => (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <span className="text-gray-700">{activity.type}</span>
                        <span className="text-gray-500">{activity.date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Lead'}
            </button>
          </div>
        </div>
      </div>

      {/* Company Research Modal - CompanyResearch.ai Style with Sidebar */}
      {showResearchModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-2">
          <div className="bg-white w-full max-w-6xl h-[95vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <Search className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-white text-lg font-bold">{formData.company}</h2>
                  <p className="text-slate-400 text-sm">{formData.email?.split('@')[1] || 'Company Research'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-semibold rounded-full flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  Live Data
                </span>
                <button
                  onClick={() => {
                    setShowResearchModal(false)
                    setResearchReport(null)
                    setResearchError(null)
                    setActiveSection('Company Overview')
                  }}
                  className="text-slate-400 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-all"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Main Content with Sidebar */}
            <div className="flex flex-1 overflow-hidden">
              
              {/* Sidebar - Section Navigation */}
              {researchReport && !isResearching && (
                <div className="w-64 bg-slate-50 border-r border-slate-200 overflow-y-auto flex-shrink-0">
                  <div className="p-4">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Sections</h3>
                    <nav className="space-y-1">
                      {(() => {
                        const sections = researchReport.split(/\[SECTION:([^\]]+)\]/).filter(Boolean);
                        const sectionNames = [];
                        for (let i = 0; i < sections.length; i += 2) {
                          if (sections[i]) sectionNames.push(sections[i].trim());
                        }
                        return sectionNames.map((name, idx) => (
                          <button
                            key={idx}
                            onClick={() => setActiveSection(name)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-all ${
                              activeSection === name
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            <FileText className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{name}</span>
                          </button>
                        ));
                      })()}
                    </nav>
                  </div>
                </div>
              )}

              {/* Content Area */}
              <div className="flex-1 overflow-y-auto bg-white">
                
                {/* Loading State */}
                {isResearching && (
                  <div className="flex flex-col items-center justify-center h-full px-6">
                    <div className="relative mb-6">
                      <div className="w-20 h-20 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Search className="h-8 w-8 text-blue-600" />
                      </div>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Analyzing {formData.company}</h3>
                    <p className="text-slate-500 text-center max-w-md mb-6">
                      Gathering comprehensive intelligence from multiple sources...
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      <span className="px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-sm font-medium animate-pulse">
                        🔍 Google Search
                      </span>
                      <span className="px-4 py-2 bg-purple-50 text-purple-600 rounded-full text-sm font-medium animate-pulse">
                        🤖 AI Analysis
                      </span>
                      <span className="px-4 py-2 bg-green-50 text-green-600 rounded-full text-sm font-medium animate-pulse">
                        📊 17 Sections
                      </span>
                    </div>
                  </div>
                )}

                {/* Error State */}
                {researchError && !isResearching && (
                  <div className="flex flex-col items-center justify-center h-full px-6">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                      <X className="h-8 w-8 text-red-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Research Failed</h3>
                    <p className="text-slate-500 text-center max-w-md mb-6">{researchError}</p>
                    <button
                      onClick={handleCompanyResearch}
                      className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                )}

                {/* Report Content */}
                {researchReport && !isResearching && (
                  <div className="p-6">
                    {(() => {
                      const sections = researchReport.split(/\[SECTION:([^\]]+)\]/).filter(Boolean);
                      const sectionMap = {};
                      for (let i = 0; i < sections.length; i += 2) {
                        const name = sections[i]?.trim();
                        const content = sections[i + 1]?.trim() || '';
                        if (name) sectionMap[name] = content;
                      }
                      
                      const currentContent = sectionMap[activeSection] || '';
                      
                      const sectionIcons = {
                        'Company Overview': '🏢',
                        'Visual Timeline': '📅',
                        'Product Summary': '📦',
                        'Competitors': '⚔️',
                        'Technology & Digital Presence': '🌐',
                        'Technology Used': '💻',
                        'Search Keyword Analysis': '🔍',
                        'Hiring & Openings': '👥',
                        'Financial Information': '💰',
                        'Job Opening Trends': '📈',
                        'Web Traffic': '📊',
                        'Key People': '👔',
                        'Recent News & Press': '📰',
                        'Website Changes': '🔄',
                        'Acquisitions': '🤝',
                        'Domains': '🌍',
                        'SWOT Analysis': '📋',
                        'Final Summary': '✅'
                      };
                      
                      const icon = sectionIcons[activeSection] || '📌';
                      
                      return (
                        <div>
                          {/* Section Header */}
                          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
                            <span className="text-3xl">{icon}</span>
                            <div>
                              <h3 className="text-2xl font-bold text-slate-900">{activeSection}</h3>
                              <p className="text-sm text-slate-500">AI-generated from live data</p>
                            </div>
                          </div>
                          
                          {/* Section Content */}
                          <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                            <div className="prose prose-slate max-w-none">
                              {currentContent.split('\n').map((line, i) => {
                                const trimmedLine = line.trim();
                                if (!trimmedLine) return null;
                                
                                if (trimmedLine.startsWith('-')) {
                                  const [label, ...valueParts] = trimmedLine.substring(1).split(':');
                                  const value = valueParts.join(':').trim();
                                  
                                  if (value) {
                                    return (
                                      <div key={i} className="flex py-2 border-b border-slate-200 last:border-0">
                                        <span className="text-slate-500 font-medium min-w-[200px]">{label.trim()}</span>
                                        <span className="text-slate-800">{value}</span>
                                      </div>
                                    );
                                  }
                                  return (
                                    <div key={i} className="flex items-start gap-2 py-1">
                                      <span className="text-blue-500 mt-1">•</span>
                                      <span className="text-slate-700">{trimmedLine.substring(1).trim()}</span>
                                    </div>
                                  );
                                }
                                
                                return <p key={i} className="text-slate-700 leading-relaxed py-1">{trimmedLine}</p>;
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 flex items-center justify-between flex-shrink-0">
              <p className="text-xs text-slate-500">
                Powered by Groq AI • Google Search • Tavily
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowResearchModal(false)
                    setResearchReport(null)
                    setResearchError(null)
                    setActiveSection('Company Overview')
                  }}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium text-sm transition-colors"
                >
                  Close
                </button>
                {researchReport && (
                  <>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(researchReport)
                        alert('Report copied to clipboard!')
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors"
                    >
                      📋 Copy Report
                    </button>
                    <button
                      onClick={handleCompanyResearch}
                      className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium text-sm transition-colors"
                    >
                      🔄 Refresh
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default LeadDetailModal
