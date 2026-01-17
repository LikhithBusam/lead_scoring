import { useState, useEffect, useCallback } from 'react'
import LeadsList from './components/LeadsList'
import ActivitySimulator from './components/ActivitySimulator'
import AdminDashboard from './components/AdminDashboard'
import CompanySelector from './components/CompanySelector'
import CompanySettings from './components/CompanySettings'
import Navbar from './components/Navbar'

function App() {
  // Company/Tenant State
  const [currentCompany, setCurrentCompany] = useState(null)
  const [companies, setCompanies] = useState([])
  const [showCompanySelector, setShowCompanySelector] = useState(true)
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true)

  // Leads State
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [isPolling, setIsPolling] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')

  // Load saved company from localStorage on mount
  useEffect(() => {
    const savedCompanyId = localStorage.getItem('currentCompanyId')
    const savedApiKey = localStorage.getItem('currentApiKey')

    if (savedCompanyId && savedApiKey) {
      // Verify the saved company still exists
      fetchCompanyProfile(savedApiKey).then(company => {
        if (company) {
          setCurrentCompany({ ...company, api_key: savedApiKey })
          setShowCompanySelector(false)
        } else {
          // Saved company no longer valid
          localStorage.removeItem('currentCompanyId')
          localStorage.removeItem('currentApiKey')
          setShowCompanySelector(true)
        }
        setIsLoadingCompanies(false)
      })
    } else {
      setIsLoadingCompanies(false)
      setShowCompanySelector(true)
    }
  }, [])

  // Fetch company profile
  const fetchCompanyProfile = async (apiKey) => {
    try {
      const response = await fetch('/api/v1/tenants/me', {
        headers: { 'X-API-Key': apiKey }
      })
      const data = await response.json()
      if (data.success) {
        return data.tenant
      }
      return null
    } catch (error) {
      console.error('Error fetching company:', error)
      return null
    }
  }

  // Handle company selection
  const handleSelectCompany = (company) => {
    setCurrentCompany(company)
    localStorage.setItem('currentCompanyId', company.tenant_id)
    localStorage.setItem('currentApiKey', company.api_key)
    setShowCompanySelector(false)
    setActiveTab('dashboard')
    // Reset all state for new company
    setLeads([])
    setLastUpdate(null)
    setLoading(true)
  }

  // Handle company switch (from navbar)
  const handleSwitchCompany = () => {
    setShowCompanySelector(true)
  }

  // Handle logout / clear company
  const handleLogout = () => {
    setCurrentCompany(null)
    localStorage.removeItem('currentCompanyId')
    localStorage.removeItem('currentApiKey')
    setShowCompanySelector(true)
    setLeads([])
  }

  // Fetch leads for current company
  const fetchLeads = useCallback(async () => {
    if (!currentCompany?.api_key) return

    try {
      const response = await fetch('/api/v1/leads', {
        headers: {
          'X-API-Key': currentCompany.api_key
        }
      })
      const data = await response.json()
      setLeads(data.leads || [])
      setLastUpdate(new Date())
    } catch (error) {
      console.error('Error fetching leads:', error)
    } finally {
      setLoading(false)
    }
  }, [currentCompany?.api_key])

  // Fetch leads when company changes
  useEffect(() => {
    if (currentCompany) {
      fetchLeads()
    }
  }, [currentCompany, fetchLeads])

  // Real-time polling every 15 seconds
  useEffect(() => {
    if (!isPolling || !currentCompany) return

    const intervalId = setInterval(() => {
      fetchLeads()
    }, 15000)

    return () => clearInterval(intervalId)
  }, [fetchLeads, isPolling, currentCompany])

  // Lead update handler
  const handleLeadUpdate = async (updatedLead) => {
    if (!currentCompany?.api_key) return

    try {
      const response = await fetch(`/api/leads/${updatedLead.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': currentCompany.api_key
        },
        body: JSON.stringify(updatedLead),
      })
      const data = await response.json()
      setLeads(prevLeads =>
        prevLeads.map(lead => lead.id === data.id ? data : lead)
      )
      setLastUpdate(new Date())
      return data
    } catch (error) {
      console.error('Error updating lead:', error)
      throw error
    }
  }

  // Track activity
  const trackActivity = async (leadId, activityType, metadata = {}) => {
    if (!currentCompany?.api_key) return

    try {
      const response = await fetch('/api/track-activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': currentCompany.api_key
        },
        body: JSON.stringify({ leadId, activityType, metadata }),
      })
      const data = await response.json()

      if (data.success) {
        setLeads(prevLeads =>
          prevLeads.map(lead =>
            lead.id === leadId
              ? {
                ...lead,
                score: data.newScore,
                classification: data.classification,
                scoreBreakdown: data.breakdown,
                lastScoreUpdate: data.lastScoreUpdate
              }
              : lead
          )
        )
        setLastUpdate(new Date())
      }
      return data
    } catch (error) {
      console.error('Error tracking activity:', error)
      throw error
    }
  }

  // Recalculate score
  const recalculateScore = async (leadId) => {
    if (!currentCompany?.api_key) return

    try {
      const response = await fetch(`/api/recalculate-score/${leadId}`, {
        method: 'POST',
        headers: {
          'X-API-Key': currentCompany.api_key
        }
      })
      const data = await response.json()

      if (data.success) {
        setLeads(prevLeads =>
          prevLeads.map(lead =>
            lead.id === leadId
              ? {
                ...lead,
                score: data.score,
                classification: data.classification,
                scoreBreakdown: data.breakdown,
                lastScoreUpdate: data.lastScoreUpdate
              }
              : lead
          )
        )
        setLastUpdate(new Date())
      }
      return data
    } catch (error) {
      console.error('Error recalculating score:', error)
      throw error
    }
  }

  // Handle activity tracked from simulator
  const handleActivityTracked = (leadId, data) => {
    setLeads(prevLeads =>
      prevLeads.map(lead =>
        lead.id === leadId
          ? {
            ...lead,
            score: data.newScore,
            classification: data.classification,
            scoreBreakdown: data.breakdown,
            lastScoreUpdate: data.lastScoreUpdate
          }
          : lead
      )
    )
    setLastUpdate(new Date())
  }

  // Show loading while checking for saved company
  if (isLoadingCompanies) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    )
  }

  // Show company selector if no company selected
  if (showCompanySelector || !currentCompany) {
    return (
      <CompanySelector
        onSelectCompany={handleSelectCompany}
        currentCompany={currentCompany}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar with Company Switcher */}
      <Navbar
        currentCompany={currentCompany}
        onSwitchCompany={handleSwitchCompany}
        onLogout={handleLogout}
        lastUpdate={lastUpdate}
        isPolling={isPolling}
        onTogglePolling={() => setIsPolling(!isPolling)}
      />

      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Tab Navigation */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'dashboard'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              ⚙️ Admin Dashboard
            </button>
            <button
              onClick={() => setActiveTab('leads')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'leads'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              📊 Lead Management
            </button>
            <button
              onClick={() => setActiveTab('simulator')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'simulator'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              🎯 Activity Simulator
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'settings'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              🔧 Company Settings
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'dashboard' ? (
          <AdminDashboard apiKey={currentCompany.api_key} />
        ) : activeTab === 'leads' ? (
          loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Loading leads...</div>
            </div>
          ) : (
            <LeadsList
              leads={leads}
              onLeadUpdate={handleLeadUpdate}
              onRefresh={fetchLeads}
              onTrackActivity={trackActivity}
              onRecalculateScore={recalculateScore}
            />
          )
        ) : activeTab === 'simulator' ? (
          <ActivitySimulator
            onActivityTracked={handleActivityTracked}
            apiKey={currentCompany.api_key}
          />
        ) : activeTab === 'settings' ? (
          <CompanySettings
            company={currentCompany}
            apiKey={currentCompany.api_key}
            onCompanyUpdate={(updated) => setCurrentCompany({ ...currentCompany, ...updated })}
          />
        ) : null}
      </div>
    </div>
  )
}

export default App
