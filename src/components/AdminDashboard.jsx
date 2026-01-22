import { useState, useEffect } from 'react'
import {
    Globe, Plus, Settings, Eye, Check, X, RefreshCw,
    FileText, Zap, AlertCircle, ChevronRight, Code,
    Building2, BarChart3, Target, Layers, Trash2
} from 'lucide-react'

const AdminDashboard = ({ apiKey }) => {
    // State
    const [tenant, setTenant] = useState(null)
    const [websites, setWebsites] = useState([])
    const [selectedWebsite, setSelectedWebsite] = useState(null)
    const [pages, setPages] = useState([])
    const [discoveredPages, setDiscoveredPages] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeSection, setActiveSection] = useState('overview') // overview, websites, pages, discovered

    // Modal states
    const [showAddWebsite, setShowAddWebsite] = useState(false)
    const [showAddPage, setShowAddPage] = useState(false)
    const [newWebsite, setNewWebsite] = useState({ website_url: '', website_name: '' })
    const [newPage, setNewPage] = useState({ page_url: '', page_name: '', page_category: 'medium-value', base_points: 5 })

    // Fetch tenant profile
    useEffect(() => {
        fetchTenantProfile()
        fetchWebsites()
    }, [])

    const fetchTenantProfile = async () => {
        try {
            const response = await fetch('/api/v1/tenants/me', {
                headers: { 'X-API-Key': apiKey }
            })
            const data = await response.json()
            if (data.success) {
                setTenant(data.tenant)
            }
        } catch (error) {
            console.error('Error fetching tenant:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchWebsites = async () => {
        try {
            const response = await fetch('/api/v1/websites', {
                headers: { 'X-API-Key': apiKey }
            })
            const data = await response.json()
            if (data.success) {
                setWebsites(data.websites || [])
                if (data.websites?.length > 0 && !selectedWebsite) {
                    setSelectedWebsite(data.websites[0])
                    fetchPages(data.websites[0].website_id)
                    fetchDiscoveredPages(data.websites[0].website_id)
                }
            }
        } catch (error) {
            console.error('Error fetching websites:', error)
        }
    }

    const fetchPages = async (websiteId) => {
        try {
            const response = await fetch(`/api/v1/websites/${websiteId}/pages`, {
                headers: { 'X-API-Key': apiKey }
            })
            const data = await response.json()
            if (data.success) {
                setPages(data.pages || [])
            }
        } catch (error) {
            console.error('Error fetching pages:', error)
        }
    }

    const fetchDiscoveredPages = async (websiteId) => {
        try {
            const response = await fetch(`/api/v1/websites/${websiteId}/discovered-pages`, {
                headers: { 'X-API-Key': apiKey }
            })
            const data = await response.json()
            if (data.success) {
                setDiscoveredPages(data.discovered_pages || [])
            }
        } catch (error) {
            console.error('Error fetching discovered pages:', error)
        }
    }

    // Add new website (Step 3 in workflow)
    const handleAddWebsite = async () => {
        try {
            const response = await fetch('/api/v1/websites', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey
                },
                body: JSON.stringify(newWebsite)
            })
            const data = await response.json()
            if (data.success) {
                alert(`Website added! Default template with ${data.website.default_pages_created} pages created.`)
                fetchWebsites()
                setShowAddWebsite(false)
                setNewWebsite({ website_url: '', website_name: '' })
            } else {
                alert('Error: ' + (data.error || 'Failed to add website'))
            }
        } catch (error) {
            console.error('Error adding website:', error)
            alert('Failed to add website')
        }
    }

    // Add manual page (Step 8 in workflow)
    const handleAddPage = async () => {
        if (!selectedWebsite) return
        try {
            const response = await fetch(`/api/v1/websites/${selectedWebsite.website_id}/pages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey
                },
                body: JSON.stringify(newPage)
            })
            const data = await response.json()
            if (data.success) {
                fetchPages(selectedWebsite.website_id)
                setShowAddPage(false)
                setNewPage({ page_url: '', page_name: '', page_category: 'medium-value', base_points: 5 })
            }
        } catch (error) {
            console.error('Error adding page:', error)
        }
    }

    // Update page points
    const handleUpdatePage = async (pageId, updates) => {
        if (!selectedWebsite) return
        try {
            const response = await fetch(`/api/v1/websites/${selectedWebsite.website_id}/pages/${pageId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey
                },
                body: JSON.stringify(updates)
            })
            const data = await response.json()
            if (data.success) {
                fetchPages(selectedWebsite.website_id)
            }
        } catch (error) {
            console.error('Error updating page:', error)
        }
    }

    // Delete page
    const handleDeletePage = async (pageId, pageName) => {
        if (!selectedWebsite) return

        // Confirmation dialog
        const confirmed = window.confirm(`Are you sure you want to delete the page "${pageName}"?\n\nThis action cannot be undone.`)
        if (!confirmed) return

        try {
            const response = await fetch(`/api/v1/websites/${selectedWebsite.website_id}/pages/${pageId}`, {
                method: 'DELETE',
                headers: {
                    'X-API-Key': apiKey
                }
            })
            const data = await response.json()
            if (data.success) {
                fetchPages(selectedWebsite.website_id)
            } else {
                alert('Error: ' + (data.error || 'Failed to delete page'))
            }
        } catch (error) {
            console.error('Error deleting page:', error)
            alert('Failed to delete page')
        }
    }

    // Approve discovered page (Step 7B)
    const handleApproveDiscoveredPage = async (discoveryId, pageData) => {
        if (!selectedWebsite) return
        try {
            const response = await fetch(`/api/v1/websites/${selectedWebsite.website_id}/discovered-pages/${discoveryId}/approve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey
                },
                body: JSON.stringify({
                    page_name: pageData.page_title || pageData.page_url,
                    page_category: 'medium-value',
                    base_points: 5
                })
            })
            const data = await response.json()
            if (data.success) {
                fetchPages(selectedWebsite.website_id)
                fetchDiscoveredPages(selectedWebsite.website_id)
            }
        } catch (error) {
            console.error('Error approving page:', error)
        }
    }

    // Reject discovered page
    const handleRejectDiscoveredPage = async (discoveryId) => {
        if (!selectedWebsite) return
        try {
            const response = await fetch(`/api/v1/websites/${selectedWebsite.website_id}/discovered-pages/${discoveryId}/reject`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey
                }
            })
            const data = await response.json()
            if (data.success) {
                fetchDiscoveredPages(selectedWebsite.website_id)
            }
        } catch (error) {
            console.error('Error rejecting page:', error)
        }
    }

    // Select website
    const handleSelectWebsite = (website) => {
        setSelectedWebsite(website)
        fetchPages(website.website_id)
        fetchDiscoveredPages(website.website_id)
    }

    const getCategoryColor = (category) => {
        switch (category) {
            case 'high-value': return 'bg-red-100 text-red-800'
            case 'medium-value': return 'bg-yellow-100 text-yellow-800'
            case 'low-value': return 'bg-green-100 text-green-800'
            default: return 'bg-gray-100 text-gray-800'
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading dashboard...</div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Workflow Steps Overview */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-6 text-white">
                <h2 className="text-xl font-bold mb-4">🎯 Lead Scoring Workflow</h2>
                <div className="grid grid-cols-5 gap-4">
                    <div className="text-center">
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
                            <Building2 className="h-5 w-5" />
                        </div>
                        <div className="text-xs font-medium">1. Company Setup</div>
                        <div className="text-xs opacity-75">✓ Complete</div>
                    </div>
                    <div className="text-center">
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
                            <Globe className="h-5 w-5" />
                        </div>
                        <div className="text-xs font-medium">2. Add Website</div>
                        <div className="text-xs opacity-75">{websites.length} active</div>
                    </div>
                    <div className="text-center">
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
                            <Layers className="h-5 w-5" />
                        </div>
                        <div className="text-xs font-medium">3. Configure Pages</div>
                        <div className="text-xs opacity-75">{pages.length} pages</div>
                    </div>
                    <div className="text-center">
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
                            <Eye className="h-5 w-5" />
                        </div>
                        <div className="text-xs font-medium">4. Review Discovered</div>
                        <div className="text-xs opacity-75">{discoveredPages.filter(p => p.review_status === 'pending').length} pending</div>
                    </div>
                    <div className="text-center">
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
                            <Target className="h-5 w-5" />
                        </div>
                        <div className="text-xs font-medium">5. Track Leads</div>
                        <div className="text-xs opacity-75">{tenant?.stats?.leads || 0} leads</div>
                    </div>
                </div>
            </div>

            {/* Tenant Overview */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-blue-600" />
                        Tenant Profile
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${tenant?.plan_type === 'enterprise' ? 'bg-purple-100 text-purple-800' :
                            tenant?.plan_type === 'pro' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                        }`}>
                        {tenant?.plan_type?.toUpperCase() || 'FREE'}
                    </span>
                </div>
                <div className="grid grid-cols-4 gap-6">
                    <div>
                        <div className="text-sm text-gray-500">Company</div>
                        <div className="text-lg font-semibold">{tenant?.company_name || 'N/A'}</div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-500">Websites</div>
                        <div className="text-lg font-semibold">{tenant?.stats?.websites || 0}</div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-500">Total Leads</div>
                        <div className="text-lg font-semibold">{tenant?.stats?.leads || 0}</div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-500">API Calls (This Month)</div>
                        <div className="text-lg font-semibold">{tenant?.stats?.usage?.api_calls || 0}</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6">
                {/* Websites Panel */}
                <div className="col-span-4 bg-white rounded-lg shadow-md">
                    <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                            <Globe className="h-5 w-5 text-blue-600" />
                            Websites
                        </h3>
                        <button
                            onClick={() => setShowAddWebsite(true)}
                            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Plus className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                        {websites.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                <Globe className="h-12 w-12 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">No websites added yet</p>
                                <button
                                    onClick={() => setShowAddWebsite(true)}
                                    className="mt-2 text-blue-600 text-sm hover:underline"
                                >
                                    Add your first website
                                </button>
                            </div>
                        ) : (
                            websites.map(website => (
                                <div
                                    key={website.website_id}
                                    onClick={() => handleSelectWebsite(website)}
                                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${selectedWebsite?.website_id === website.website_id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-gray-900 truncate">{website.website_name}</p>
                                            <p className="text-xs text-gray-500 truncate">{website.website_url}</p>
                                        </div>
                                        <ChevronRight className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <div className="mt-2 flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded text-xs ${website.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                            {website.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            Code: {website.tracking_code?.substring(0, 12)}...
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Pages Configuration Panel */}
                <div className="col-span-8 bg-white rounded-lg shadow-md">
                    {selectedWebsite ? (
                        <>
                            <div className="p-4 border-b border-gray-200">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                            <FileText className="h-5 w-5 text-blue-600" />
                                            Page Configuration
                                        </h3>
                                        <p className="text-sm text-gray-500">{selectedWebsite.website_name}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                fetchPages(selectedWebsite.website_id)
                                                fetchDiscoveredPages(selectedWebsite.website_id)
                                            }}
                                            className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
                                        >
                                            <RefreshCw className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => setShowAddPage(true)}
                                            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors flex items-center gap-1"
                                        >
                                            <Plus className="h-4 w-4" />
                                            Add Page
                                        </button>
                                    </div>
                                </div>

                                {/* Tab navigation */}
                                <div className="mt-4 flex gap-4">
                                    <button
                                        onClick={() => setActiveSection('pages')}
                                        className={`px-4 py-2 text-sm font-medium rounded-lg ${activeSection === 'pages' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'
                                            }`}
                                    >
                                        Configured Pages ({pages.length})
                                    </button>
                                    <button
                                        onClick={() => setActiveSection('discovered')}
                                        className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 ${activeSection === 'discovered' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'
                                            }`}
                                    >
                                        Discovered Pages
                                        {discoveredPages.filter(p => p.review_status === 'pending').length > 0 && (
                                            <span className="bg-orange-500 text-white rounded-full px-2 py-0.5 text-xs">
                                                {discoveredPages.filter(p => p.review_status === 'pending').length}
                                            </span>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setActiveSection('script')}
                                        className={`px-4 py-2 text-sm font-medium rounded-lg ${activeSection === 'script' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'
                                            }`}
                                    >
                                        <Code className="h-4 w-4 inline mr-1" />
                                        Install Script
                                    </button>
                                </div>
                            </div>

                            <div className="p-4 max-h-96 overflow-y-auto">
                                {activeSection === 'pages' && (
                                    <div className="space-y-2">
                                        {pages.length === 0 ? (
                                            <div className="text-center py-8 text-gray-500">
                                                <FileText className="h-12 w-12 mx-auto mb-2 opacity-30" />
                                                <p>No pages configured</p>
                                                <p className="text-xs mt-1">Default pages should be auto-created when website was added</p>
                                            </div>
                                        ) : (
                                            <table className="w-full">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Page URL</th>
                                                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Name</th>
                                                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Category</th>
                                                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Points</th>
                                                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Status</th>
                                                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {pages.map(page => (
                                                        <tr key={page.page_id} className="hover:bg-gray-50">
                                                            <td className="px-4 py-3 text-sm font-mono text-gray-700">{page.page_url}</td>
                                                            <td className="px-4 py-3 text-sm text-gray-900">{page.page_name}</td>
                                                            <td className="px-4 py-3">
                                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(page.page_category)}`}>
                                                                    {page.page_category}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <input
                                                                    type="number"
                                                                    value={page.base_points}
                                                                    onChange={(e) => handleUpdatePage(page.page_id, { base_points: parseInt(e.target.value) })}
                                                                    className="w-16 px-2 py-1 border rounded text-center text-sm"
                                                                    min="0"
                                                                    max="100"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span className={`px-2 py-0.5 rounded text-xs ${page.is_tracked ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                                    {page.is_tracked ? 'Tracked' : 'Disabled'}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <button
                                                                    onClick={() => handleDeletePage(page.page_id, page.page_name)}
                                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                                    title="Delete page"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                )}

                                {activeSection === 'discovered' && (
                                    <div className="space-y-2">
                                        {discoveredPages.length === 0 ? (
                                            <div className="text-center py-8 text-gray-500">
                                                <Eye className="h-12 w-12 mx-auto mb-2 opacity-30" />
                                                <p>No discovered pages yet</p>
                                                <p className="text-xs mt-1">Pages will appear here as visitors browse your website</p>
                                            </div>
                                        ) : (
                                            <table className="w-full">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Page URL</th>
                                                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Title</th>
                                                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Visits</th>
                                                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Status</th>
                                                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {discoveredPages.map(page => (
                                                        <tr key={page.discovery_id} className="hover:bg-gray-50">
                                                            <td className="px-4 py-3 text-sm font-mono text-gray-700">{page.page_url}</td>
                                                            <td className="px-4 py-3 text-sm text-gray-900">{page.page_title || '-'}</td>
                                                            <td className="px-4 py-3 text-sm text-gray-600">{page.visit_count}</td>
                                                            <td className="px-4 py-3">
                                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${page.review_status === 'pending' ? 'bg-orange-100 text-orange-700' :
                                                                        page.review_status === 'approved' ? 'bg-green-100 text-green-700' :
                                                                            'bg-red-100 text-red-700'
                                                                    }`}>
                                                                    {page.review_status}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {page.review_status === 'pending' && (
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            onClick={() => handleApproveDiscoveredPage(page.discovery_id, page)}
                                                                            className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                                                                            title="Approve & Add"
                                                                        >
                                                                            <Check className="h-4 w-4" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleRejectDiscoveredPage(page.discovery_id)}
                                                                            className="p-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                                                                            title="Reject"
                                                                        >
                                                                            <X className="h-4 w-4" />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                )}

                                {activeSection === 'script' && (
                                    <div className="space-y-4">
                                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                            <div className="flex items-start gap-2">
                                                <Check className="h-5 w-5 text-green-600 mt-0.5" />
                                                <div>
                                                    <h4 className="font-medium text-green-800">Production-Ready Tracking Script</h4>
                                                    <p className="text-sm text-green-700">Single line installation - works on any website, React, WordPress, or CMS.</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                                            <pre className="text-sm text-gray-100 whitespace-pre-wrap">
{`<script
  src="http://localhost:3001/tracking-plugin/lead-scorer.js"
  data-website-id="${selectedWebsite.website_id}"
  data-api-key="${apiKey}"
  data-api-url="http://localhost:3001/api/v1"
  data-debug="false">
</script>`}
                                            </pre>
                                        </div>
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                            <h4 className="font-medium text-blue-800 mb-2">What this script tracks:</h4>
                                            <ul className="text-sm text-blue-700 space-y-1">
                                                <li>• <strong>Page Views</strong> - Automatically tracked with configured scoring</li>
                                                <li>• <strong>Form Submissions</strong> - Creates leads when users submit forms</li>
                                                <li>• <strong>CTA Clicks</strong> - Add <code className="bg-blue-100 px-1 rounded">data-ls-track="button-name"</code> to any element</li>
                                                <li>• <strong>SPA Navigation</strong> - Works with React Router, Vue Router, etc.</li>
                                            </ul>
                                        </div>
                                        <p className="text-sm text-gray-500">
                                            Website ID: <code className="bg-gray-100 px-2 py-1 rounded">{selectedWebsite.website_id}</code>
                                        </p>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="p-12 text-center text-gray-500">
                            <Globe className="h-16 w-16 mx-auto mb-4 opacity-30" />
                            <p className="text-lg">Select a website to configure</p>
                            <p className="text-sm mt-1">Or add a new website to get started</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Website Modal */}
            {showAddWebsite && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md">
                        <h3 className="text-lg font-semibold mb-4">Add New Website</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            A default page template (Home, About, Pricing, Contact, Demo) will be automatically created.
                        </p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Website Name</label>
                                <input
                                    type="text"
                                    value={newWebsite.website_name}
                                    onChange={(e) => setNewWebsite({ ...newWebsite, website_name: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    placeholder="My Company Website"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Website URL</label>
                                <input
                                    type="url"
                                    value={newWebsite.website_url}
                                    onChange={(e) => setNewWebsite({ ...newWebsite, website_url: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    placeholder="https://example.com"
                                />
                            </div>
                        </div>
                        <div className="mt-6 flex gap-3 justify-end">
                            <button
                                onClick={() => setShowAddWebsite(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddWebsite}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                Add Website
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Page Modal */}
            {showAddPage && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md">
                        <h3 className="text-lg font-semibold mb-4">Add Page Manually</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Page URL</label>
                                <input
                                    type="text"
                                    value={newPage.page_url}
                                    onChange={(e) => setNewPage({ ...newPage, page_url: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    placeholder="/features"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Page Name</label>
                                <input
                                    type="text"
                                    value={newPage.page_name}
                                    onChange={(e) => setNewPage({ ...newPage, page_name: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    placeholder="Features Page"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                <select
                                    value={newPage.page_category}
                                    onChange={(e) => setNewPage({ ...newPage, page_category: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="high-value">High Value (10-20 pts)</option>
                                    <option value="medium-value">Medium Value (3-10 pts)</option>
                                    <option value="low-value">Low Value (1-3 pts)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
                                <input
                                    type="number"
                                    value={newPage.base_points}
                                    onChange={(e) => setNewPage({ ...newPage, base_points: parseInt(e.target.value) })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    min="0"
                                    max="100"
                                />
                            </div>
                        </div>
                        <div className="mt-6 flex gap-3 justify-end">
                            <button
                                onClick={() => setShowAddPage(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddPage}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                Add Page
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default AdminDashboard
