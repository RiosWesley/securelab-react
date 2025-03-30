// src/utils/notifications.js
import { library } from '@fortawesome/fontawesome-svg-core';
import { faCheckCircle, faTimesCircle, faExclamationTriangle, faInfoCircle, faTimes } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

library.add(faCheckCircle, faTimesCircle, faExclamationTriangle, faInfoCircle, faTimes);

let notificationContainer = null;

function ensureContainer() {
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        // Apply styles via CSS or inline for positioning
        notificationContainer.style.position = 'fixed';
        notificationContainer.style.top = '20px';
        notificationContainer.style.right = '20px';
        notificationContainer.style.zIndex = '9999';
        notificationContainer.style.maxWidth = '350px';
        document.body.appendChild(notificationContainer);
    }
}

export function showNotification(message, type = 'info', duration = 5000) {
    ensureContainer();

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`; // Use classes from components.css

    let iconType;
    switch (type) {
        case 'success': iconType = faCheckCircle; break;
        case 'error': iconType = faTimesCircle; break;
        case 'warning': iconType = faExclamationTriangle; break;
        default: iconType = faInfoCircle; break;
    }

    // Create elements programmatically to use FontAwesomeIcon (though direct HTML insertion works too)
    const iconElement = document.createElement('div');
    iconElement.className = 'notification-icon';
    // Temporary workaround for FontAwesome in vanilla JS context: use innerHTML
    iconElement.innerHTML = `<i class="fas fa-${iconType.iconName}" style="font-size: 1.2rem; color: var(--${type}-color, inherit);"></i>`;

    const messageElement = document.createElement('div');
    messageElement.className = 'notification-message';
    messageElement.textContent = message;

    const closeButton = document.createElement('button');
    closeButton.className = 'notification-close'; // Use class from components.css
    // Temporary workaround for FontAwesome
    closeButton.innerHTML = `<i class="fas fa-times"></i>`;

    notification.appendChild(iconElement);
    notification.appendChild(messageElement);
    notification.appendChild(closeButton);

    notificationContainer.appendChild(notification);

    // Show animation
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
        notification.style.opacity = '1';
    }, 10);
    // Apply initial styles for animation
    notification.style.marginBottom = '10px';
    notification.style.borderRadius = '4px';
    notification.style.backgroundColor = 'white';
    notification.style.boxShadow = '0 3px 8px rgba(0, 0, 0, 0.15)';
    notification.style.display = 'flex';
    notification.style.alignItems = 'center';
    notification.style.padding = '12px 15px';
    notification.style.transform = 'translateX(120%)';
    notification.style.opacity = '0';
    notification.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
    // Add border based on type - ensure components.css has these or add styles here
    notification.style.borderLeft = `4px solid var(--${type}-color, #17a2b8)`;


    const closeNotification = () => {
        notification.style.transform = 'translateX(120%)';
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    };

    closeButton.addEventListener('click', closeNotification);

    const timeoutId = setTimeout(closeNotification, duration);

    // Allow hover to pause timer (optional)
    notification.addEventListener('mouseenter', () => clearTimeout(timeoutId));
    notification.addEventListener('mouseleave', () => setTimeout(closeNotification, duration));
}

// CSS definitions if not in components.css:
/*
.notification-container { ... }
.notification { ... animation: fadeIn 0.3s ease-out; ... }
.notification-success { border-left: 4px solid var(--success-color); }
.notification-error { border-left: 4px solid var(--danger-color); }
.notification-warning { border-left: 4px solid var(--warning-color); }
.notification-info { border-left: 4px solid var(--info-color); }
.notification-icon { margin-right: 10px; }
.notification-message { flex: 1; font-size: 0.9rem; }
.notification-close { background: none; border: none; cursor: pointer; color: #6c757d; margin-left: 10px; }
*/