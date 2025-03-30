// src/components/Modal.jsx
import React, { useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import '../styles/components.css'; // Ensure modal styles from components.css are loaded

function Modal({ isOpen, onClose, title, children, footer, size = 'md' }) { // Added size prop

    // Effect to add/remove class from body to prevent scrolling when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.classList.add('modal-open');
        } else {
            document.body.classList.remove('modal-open');
        }
        // Cleanup function
        return () => {
            document.body.classList.remove('modal-open');
        };
    }, [isOpen]);

    // Effect for Escape key closing
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]); // Re-run if isOpen or onClose changes


    if (!isOpen) {
        return null; // Don't render anything if the modal is not open
    }

    // Determine modal dialog size class
    let sizeClass = '';
    if (size === 'sm') sizeClass = 'modal-sm';
    if (size === 'lg') sizeClass = 'modal-lg';

    // Stop propagation on dialog click to prevent closing when clicking inside
    const handleDialogClick = (e) => {
        e.stopPropagation();
    };

    return (
        // Use `onClick={onClose}` on the overlay div
        <div className={`modal ${isOpen ? 'active' : ''}`} onClick={onClose}>
            {/* Use `onClick={handleDialogClick}` on the dialog div */}
            <div className={`modal-dialog ${sizeClass}`} onClick={handleDialogClick}>
                <div className="modal-content">
                    {title && (
                        <div className="modal-header">
                            <h3>{title}</h3>
                            <button className="close-button" onClick={onClose} aria-label="Fechar">
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        </div>
                    )}
                    <div className="modal-body">
                        {children}
                    </div>
                    {footer && (
                        <div className="modal-footer">
                            {footer}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Modal;