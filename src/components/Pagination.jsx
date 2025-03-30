// src/components/Pagination.jsx
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import '../styles/components.css'; // Ensure pagination styles are loaded

function Pagination({ currentPage, totalPages, onPageChange, totalItems, itemsPerPage }) {

    if (totalPages <= 1) {
        // Optionally render nothing or just the info if only one page
        return (
            <div className="pagination-container mt-4">
                <div className="pagination-info">
                    Exibindo {totalItems} de {totalItems} itens
                </div>
            </div>
        );
    }

    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(startItem + itemsPerPage - 1, totalItems);

    // Basic pagination numbers (can be improved with ellipsis logic later)
    const getPageNumbers = () => {
        const pages = [];
        // Example: Show first, last, current, and neighbors
        const maxPagesToShow = 5; // Adjust as needed
        if (totalPages <= maxPagesToShow) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1); // Always show first page
            let start = Math.max(2, currentPage - 1);
            let end = Math.min(totalPages - 1, currentPage + 1);

            if (currentPage <= 3) {
                start = 2; end = 4;
            } else if (currentPage >= totalPages - 2) {
                start = totalPages - 3; end = totalPages - 1;
            }

            if (start > 2) pages.push('...');
            for (let i = start; i <= end; i++) pages.push(i);
            if (end < totalPages - 1) pages.push('...');
            pages.push(totalPages); // Always show last page
        }
        return pages;
    };


    return (
        <div className="pagination-container mt-4">
            {/* Info */}
            <div className="pagination-info">
                Exibindo {startItem} - {endItem} de {totalItems} itens
            </div>

            {/* Controls */}
            <div className="pagination">
                {/* Previous Button */}
                <button
                    className="pagination-btn"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    aria-label="Página Anterior"
                >
                    <FontAwesomeIcon icon={faChevronLeft} />
                </button>

                {/* Page Numbers */}
                <div className="pagination-numbers">
                    {getPageNumbers().map((page, index) =>
                        typeof page === 'number' ? (
                            <button
                                key={page}
                                className={`page-number ${page === currentPage ? 'active' : ''}`}
                                onClick={() => onPageChange(page)}
                            >
                                {page}
                            </button>
                        ) : (
                            <span key={`ellipsis-${index}`} className="page-ellipsis" style={{padding: '6px 10px', color: '#6c757d'}}>...</span> // Simple ellipsis
                        )
                    )}
                </div>


                {/* Next Button */}
                <button
                    className="pagination-btn"
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    aria-label="Próxima Página"
                >
                    <FontAwesomeIcon icon={faChevronRight} />
                </button>
            </div>
        </div>
    );
}

export default Pagination;