function validateAdmin(token) {
    // Add validating logic here.
    return token === 'admin-123';
}

function hasUserToken() {
    return document.cookie.split('; ').some(cookie => cookie === 'userToken=authenticated');
}

const dashboard = document.querySelector('.home-page');
if (dashboard) dashboard.hidden = !hasUserToken();