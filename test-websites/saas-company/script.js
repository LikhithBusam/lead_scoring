// CloudFlow SaaS - Button Click Tracking with Lead Scoring Integration

// Handle "Request Demo" button clicks
function handleDemoClick() {
    console.log('🎯 CTA CLICKED: Request Demo');
    
    // Show demo request modal
    showDemoModal();
}

// Show demo request modal
function showDemoModal() {
    const modal = document.createElement('div');
    modal.id = 'demoModal';
    modal.innerHTML = `
        <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;">
            <div style="background:white;padding:30px;border-radius:12px;max-width:400px;width:90%;">
                <h2 style="margin-bottom:20px;color:#333;">Request a Demo</h2>
                <form id="demoForm" onsubmit="handleDemoSubmit(event)">
                    <div style="margin-bottom:15px;">
                        <label style="display:block;margin-bottom:5px;font-weight:500;">Full Name *</label>
                        <input type="text" name="name" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;">
                    </div>
                    <div style="margin-bottom:15px;">
                        <label style="display:block;margin-bottom:5px;font-weight:500;">Email *</label>
                        <input type="email" name="email" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;">
                    </div>
                    <div style="margin-bottom:15px;">
                        <label style="display:block;margin-bottom:5px;font-weight:500;">Company</label>
                        <input type="text" name="company" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;">
                    </div>
                    <div style="margin-bottom:15px;">
                        <label style="display:block;margin-bottom:5px;font-weight:500;">Phone</label>
                        <input type="tel" name="phone" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;">
                    </div>
                    <div style="display:flex;gap:10px;">
                        <button type="submit" style="flex:1;padding:12px;background:#4F46E5;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:500;">Submit</button>
                        <button type="button" onclick="closeDemoModal()" style="flex:1;padding:12px;background:#e5e7eb;color:#333;border:none;border-radius:6px;cursor:pointer;">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function closeDemoModal() {
    const modal = document.getElementById('demoModal');
    if (modal) modal.remove();
}

// Handle demo form submission - Creates lead
async function handleDemoSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    
    const data = {
        name: formData.get('name'),
        email: formData.get('email'),
        company: formData.get('company') || '',
        phone: formData.get('phone') || '',
        page_url: window.location.pathname
    };

    console.log('📧 DEMO REQUEST SUBMITTED:', data);

    // Send to tracking API to create lead
    try {
        const config = window.LEAD_SCORER_CONFIG;
        const response = await fetch(`${config.apiUrl}/track`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': config.apiKey,
                'X-Website-Id': config.websiteId
            },
            body: JSON.stringify({
                event_type: 'form_submission',
                visitor_id: getVisitorId(),
                data: data
            })
        });
        
        const result = await response.json();
        console.log('✅ Lead created:', result);
        
        alert(`Thank you, ${data.name}! 🎉\n\nYour demo request has been submitted. Our team will contact you within 24 hours.`);
        closeDemoModal();
    } catch (error) {
        console.error('Error submitting form:', error);
        alert('Thank you! Your request has been received.');
        closeDemoModal();
    }
}

// Handle "Learn More" button clicks
function handleLearnMore() {
    console.log('🎯 CTA CLICKED: Learn More');
    window.scrollTo({
        top: document.querySelector('.features-preview')?.offsetTop || 0,
        behavior: 'smooth'
    });
}

// Handle pricing plan selection
function handlePlanClick(planName) {
    console.log('🎯 CTA CLICKED: Plan Selected - ' + planName);
    showDemoModal(); // Open demo form when plan is selected
}

// Handle contact form submission - Creates lead
async function handleFormSubmit(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const data = {
        name: formData.get('name'),
        email: formData.get('email'),
        company: formData.get('company') || '',
        message: formData.get('message') || '',
        page_url: window.location.pathname
    };

    console.log('📧 CONTACT FORM SUBMITTED:', data);

    // Send to tracking API to create lead
    try {
        const config = window.LEAD_SCORER_CONFIG;
        const response = await fetch(`${config.apiUrl}/track`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': config.apiKey,
                'X-Website-Id': config.websiteId
            },
            body: JSON.stringify({
                event_type: 'form_submission',
                visitor_id: getVisitorId(),
                data: data
            })
        });
        
        const result = await response.json();
        console.log('✅ Lead created:', result);
        
        alert(`Thank you, ${data.name}! 🎉\n\nYour message has been received. We'll get back to you within 24 hours.`);
        event.target.reset();
    } catch (error) {
        console.error('Error submitting form:', error);
        alert('Thank you! Your message has been received.');
        event.target.reset();
    }
}

// Get or create visitor ID
function getVisitorId() {
    let visitorId = localStorage.getItem('lead_scorer_visitor_id');
    if (!visitorId) {
        visitorId = 'v_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('lead_scorer_visitor_id', visitorId);
    }
    return visitorId;
}

// ==========================================
// LOGIN & SIGNUP - Creates Leads
// ==========================================

// Handle Login Form - Creates/Updates lead
async function handleLogin(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    
    const data = {
        email: formData.get('email'),
        name: 'Returning User',
        page_url: '/login'
    };

    console.log('🔐 LOGIN SUBMITTED:', data.email);

    // Track as form submission to create/update lead
    try {
        const config = window.LEAD_SCORER_CONFIG;
        if (!config) {
            console.error('LEAD_SCORER_CONFIG not found!');
            alert('Welcome back! You are now logged in.');
            window.location.href = 'index.html';
            return;
        }
        
        const response = await fetch(`${config.apiUrl}/track`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': config.apiKey,
                'X-Website-Id': config.websiteId
            },
            body: JSON.stringify({
                event_type: 'form_submission',
                visitor_id: getVisitorId(),
                data: data
            })
        });
        
        const result = await response.json();
        console.log('✅ Login tracked:', result);
        
        // Store logged in state
        localStorage.setItem('user_logged_in', 'true');
        localStorage.setItem('user_email', data.email);
        
        alert(`Welcome back! 🎉\n\nYou are now logged in.\n\n(Lead ID: ${result.lead_id || 'tracked'})`);
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error:', error);
        alert('Welcome back! You are now logged in.');
        window.location.href = 'index.html';
    }
}

// Handle Signup Form - Creates new lead
async function handleSignup(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    
    const data = {
        name: (formData.get('firstName') || '') + ' ' + (formData.get('lastName') || ''),
        email: formData.get('email'),
        company: formData.get('company') || '',
        phone: formData.get('phone') || '',
        job_title: formData.get('jobTitle') || '',
        page_url: '/signup'
    };

    console.log('📝 SIGNUP SUBMITTED:', data);

    // Send to tracking API to create lead
    try {
        const config = window.LEAD_SCORER_CONFIG;
        if (!config) {
            console.error('LEAD_SCORER_CONFIG not found!');
            alert('Welcome! Your account has been created.');
            window.location.href = 'index.html';
            return;
        }
        
        const response = await fetch(`${config.apiUrl}/track`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': config.apiKey,
                'X-Website-Id': config.websiteId
            },
            body: JSON.stringify({
                event_type: 'form_submission',
                visitor_id: getVisitorId(),
                data: data
            })
        });
        
        const result = await response.json();
        console.log('✅ Lead created from signup:', result);
        
        // Store logged in state
        localStorage.setItem('user_logged_in', 'true');
        localStorage.setItem('user_email', data.email);
        localStorage.setItem('user_name', data.name);
        
        alert(`Welcome, ${data.name.trim()}! 🎉\n\nYour account has been created.\n\n(Lead ID: ${result.lead_id || 'created'})`);
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error:', error);
        alert('Welcome! Your account has been created.');
        window.location.href = 'index.html';
    }
}

// Handle social login
function handleSocialLogin(provider) {
    console.log('🔗 SOCIAL LOGIN:', provider);
    alert(`${provider} login would redirect to OAuth provider.\n\nFor demo purposes, this is just logged.`);
}

// Handle logout
function handleLogout() {
    // Clear BOTH localStorage formats
    localStorage.removeItem('user_logged_in');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_name');
    localStorage.removeItem('cloudflow_user');
    console.log('👋 User logged out');
    window.location.reload();
}

// Update navbar based on login state
function updateNavbar() {
    const navButtons = document.getElementById('navButtons');
    if (!navButtons) {
        console.log('⚠️ navButtons element not found');
        return;
    }
    
    // Check BOTH localStorage formats (user_logged_in OR cloudflow_user)
    const isLoggedInNew = localStorage.getItem('user_logged_in') === 'true';
    const cloudflowUser = localStorage.getItem('cloudflow_user');
    const isLoggedIn = isLoggedInNew || !!cloudflowUser;
    
    let userName = 'User';
    if (cloudflowUser) {
        try {
            const user = JSON.parse(cloudflowUser);
            userName = user.name || user.email || 'User';
        } catch(e) {}
    } else {
        userName = localStorage.getItem('user_name') || localStorage.getItem('user_email') || 'User';
    }
    
    console.log('🔍 Navbar check: isLoggedIn=', isLoggedIn, 'userName=', userName);
    
    if (isLoggedIn) {
        // Show logged in state
        navButtons.innerHTML = `
            <span class="user-greeting" style="color:#4F46E5;font-weight:500;margin-right:10px;">
                👤 Welcome, ${userName.split(' ')[0]}!
            </span>
            <button onclick="handleLogout()" class="btn-login" style="cursor:pointer;background:none;border:1px solid #ddd;padding:8px 16px;border-radius:6px;">
                Logout
            </button>
            <button class="cta-btn" onclick="handleDemoClick()">Request Demo</button>
        `;
        console.log('✅ Navbar updated: User is logged in as', userName);
    } else {
        // Show login/signup buttons
        navButtons.innerHTML = `
            <a href="login.html" class="btn-login">Login</a>
            <a href="signup.html" class="btn-signup">Sign Up</a>
            <button class="cta-btn" onclick="handleDemoClick()">Request Demo</button>
        `;
        console.log('ℹ️ Navbar: User not logged in');
    }
}

// Track page views on load
window.addEventListener('load', function() {
    console.log('📄 PAGE VIEW:', window.location.pathname);
    console.log('Page Title:', document.title);
    
    // Update navbar based on login state
    updateNavbar();
    
    // Check if user is logged in
    const isLoggedIn = localStorage.getItem('user_logged_in') === 'true';
    if (isLoggedIn) {
        const userName = localStorage.getItem('user_name') || localStorage.getItem('user_email');
        console.log('👤 User is logged in:', userName);
    }
});

// Track time on page
let startTime = Date.now();
window.addEventListener('beforeunload', function() {
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    console.log('⏱️ TIME ON PAGE:', timeSpent, 'seconds');
});
