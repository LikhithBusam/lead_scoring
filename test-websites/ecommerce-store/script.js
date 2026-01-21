// TechGear E-commerce Store - Button Click Tracking

// Cart management
let cart = JSON.parse(localStorage.getItem('techgear-cart')) || [];

// Update cart count on page load
window.addEventListener('load', function() {
    updateCartCount();
    updateNavbar();
    console.log('📄 PAGE VIEW:', window.location.pathname);
    console.log('Page Title:', document.title);
    console.log('Timestamp:', new Date().toISOString());
});

function updateCartCount() {
    const cartCountElements = document.querySelectorAll('.cart-count');
    cartCountElements.forEach(el => {
        el.textContent = cart.length;
    });
}

// Handle category clicks
function handleCategoryClick(category) {
    console.log('🏷️ CATEGORY CLICKED:', category);
    console.log('Timestamp:', new Date().toISOString());
    console.log('Page:', window.location.pathname);

    alert(`Browsing ${category} category...\n\nThis click has been logged for lead scoring.`);
}

// Handle product view
function handleProductView(productName) {
    console.log('👁️ PRODUCT VIEWED:', productName);
    console.log('Timestamp:', new Date().toISOString());

    window.location.href = 'product1.html';
}

// Handle Add to Cart
function handleAddToCart(productName, price) {
    console.log('🛒 ADD TO CART:', productName, '($' + price + ')');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Page:', window.location.pathname);

    cart.push({
        name: productName,
        price: price,
        quantity: 1,
        id: Date.now()
    });

    localStorage.setItem('techgear-cart', JSON.stringify(cart));
    updateCartCount();

    alert(`${productName} added to cart!\n\nThis action has been logged for lead scoring.`);
}

// Handle Buy Now
function handleBuyNow(productName, price) {
    console.log('💳 BUY NOW CLICKED:', productName, '($' + price + ')');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Page:', window.location.pathname);

    handleAddToCart(productName, price);

    // Redirect to cart
    setTimeout(() => {
        window.location.href = 'cart.html';
    }, 500);
}

// Handle filter changes
function handleFilterChange(filterType, value) {
    console.log('🔍 FILTER CHANGED:', filterType, '=', value);
    console.log('Timestamp:', new Date().toISOString());
}

// Handle storage option change
function handleStorageChange(option) {
    console.log('💾 STORAGE OPTION CHANGED:', option);
    console.log('Timestamp:', new Date().toISOString());
}

// Tab switching
function showTab(tabId) {
    console.log('📑 TAB SWITCHED:', tabId);

    // Hide all tabs
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(tabId)?.classList.add('active');
    event.target.classList.add('active');
}

// Cart quantity management
function increaseQuantity(button) {
    const input = button.parentElement.querySelector('input');
    input.value = parseInt(input.value) + 1;
    updateCartTotal();
}

function decreaseQuantity(button) {
    const input = button.parentElement.querySelector('input');
    if (parseInt(input.value) > 1) {
        input.value = parseInt(input.value) - 1;
        updateCartTotal();
    }
}

function handleRemoveItem(button) {
    console.log('🗑️ ITEM REMOVED FROM CART');

    const cartItem = button.closest('.cart-item');
    cartItem.remove();
    updateCartTotal();
}

function handleClearCart() {
    console.log('🗑️ CART CLEARED');

    if (confirm('Are you sure you want to clear your cart?')) {
        cart = [];
        localStorage.setItem('techgear-cart', JSON.stringify(cart));
        updateCartCount();
        location.reload();
    }
}

function updateCartTotal() {
    // Calculate totals
    let subtotal = 0;
    document.querySelectorAll('.cart-item').forEach(item => {
        const price = parseFloat(item.querySelector('.item-price').textContent.replace('$', ''));
        const quantity = parseInt(item.querySelector('.item-quantity input').value);
        subtotal += price * quantity;
    });

    const tax = subtotal * 0.1;
    const total = subtotal + tax;

    // Update display
    document.getElementById('subtotal').textContent = '$' + subtotal.toFixed(2);
    document.getElementById('tax').textContent = '$' + tax.toFixed(2);
    document.getElementById('total').textContent = '$' + total.toFixed(2);
}

function handlePromoCode() {
    const promoInput = document.getElementById('promoInput');
    const code = promoInput.value.trim();

    console.log('🎟️ PROMO CODE APPLIED:', code);

    if (code) {
        alert('Promo code validation...\n\nThis action has been logged for lead scoring.');
    }
}

function handleCheckout() {
    console.log('💳 CHECKOUT INITIATED');
    console.log('Cart Items:', cart.length);

    alert('Proceeding to checkout...\n\nIn a real store, this would take you to the payment page.\n\nThis high-value action has been logged for lead scoring!');
}

function handleProductClick(productName) {
    console.log('👁️ RECOMMENDED PRODUCT CLICKED:', productName);

    alert(`Viewing ${productName}...\n\nThis click has been logged for lead scoring.`);
}

// ==========================================
// LOGIN & SIGNUP - Creates Leads
// ==========================================

// Handle Login Form
async function handleLogin(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    
    const data = {
        email: formData.get('email'),
        name: 'Returning Customer',
        page_url: '/login'
    };

    console.log('🔐 LOGIN SUBMITTED:', data.email);

    // Track as form submission to create/update lead
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
        console.log('✅ Login tracked:', result);
        
        // Store user in localStorage
        localStorage.setItem('techgear_user', JSON.stringify({
            email: data.email,
            name: data.email.split('@')[0],
            loggedInAt: new Date().toISOString()
        }));
        
        alert(`Welcome back! 🎉\n\nYou are now logged in.\n\n(Login tracked for lead scoring)`);
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error:', error);
        localStorage.setItem('techgear_user', JSON.stringify({
            email: data.email,
            name: data.email.split('@')[0],
            loggedInAt: new Date().toISOString()
        }));
        alert('Welcome back! You are now logged in.');
        window.location.href = 'index.html';
    }
}

// Handle Signup Form  
async function handleSignup(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    
    const data = {
        name: formData.get('firstName') + ' ' + formData.get('lastName'),
        email: formData.get('email'),
        phone: formData.get('phone') || '',
        company: '',
        page_url: '/signup'
    };

    console.log('📝 SIGNUP SUBMITTED:', data);

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
        console.log('✅ Lead created from signup:', result);
        
        // Store user in localStorage
        localStorage.setItem('techgear_user', JSON.stringify({
            email: data.email,
            name: data.name,
            signedUpAt: new Date().toISOString()
        }));
        
        alert(`Welcome, ${data.name}! 🎉\n\nYour account has been created successfully.\n\n(New lead created in CRM)`);
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error:', error);
        localStorage.setItem('techgear_user', JSON.stringify({
            email: data.email,
            name: data.name,
            signedUpAt: new Date().toISOString()
        }));
        alert('Welcome! Your account has been created.');
        window.location.href = 'index.html';
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

// Update navbar based on login state
function updateNavbar() {
    const navButtons = document.getElementById('navButtons');
    if (!navButtons) return;
    
    const cloudflowUser = localStorage.getItem('techgear_user');
    const isLoggedIn = !!cloudflowUser;
    
    let userName = 'User';
    if (cloudflowUser) {
        try {
            const user = JSON.parse(cloudflowUser);
            userName = user.name || user.email || 'User';
        } catch(e) {}
    }
    
    console.log('🔍 Navbar check: isLoggedIn=', isLoggedIn, 'userName=', userName);
    
    if (isLoggedIn) {
        navButtons.innerHTML = `
            <span style="color:#333;font-weight:500;margin-right:10px;">
                👤 ${userName.split(' ')[0]}
            </span>
            <button onclick="handleLogout()" style="cursor:pointer;background:none;border:1px solid #ddd;padding:8px 16px;border-radius:6px;">
                Logout
            </button>
            <a href="cart.html" class="cart-icon" style="margin-left:10px;">
                🛒 <span class="cart-count">${cart.length}</span>
            </a>
        `;
        console.log('✅ Navbar updated: User is logged in as', userName);
    } else {
        navButtons.innerHTML = `
            <a href="login.html" class="btn-login">Login</a>
            <a href="signup.html" class="btn-signup">Sign Up</a>
            <a href="cart.html" class="cart-icon">
                🛒 <span class="cart-count">${cart.length}</span>
            </a>
        `;
    }
}

// Handle logout
function handleLogout() {
    localStorage.removeItem('techgear_user');
    console.log('👋 User logged out');
    window.location.reload();
}

// Track time on page
let startTime = Date.now();
window.addEventListener('beforeunload', function() {
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    console.log('⏱️ TIME ON PAGE:', timeSpent, 'seconds');
    console.log('Final Cart Count:', cart.length);
});
