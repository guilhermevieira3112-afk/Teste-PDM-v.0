import React from 'react';

export const DogPawIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {/* Four outer toes */}
    <ellipse cx="5.5" cy="9.5" rx="1.6" ry="2.2" transform="rotate(-18 5.5 9.5)" />
    <ellipse cx="9.6" cy="6.2" rx="1.6" ry="2.3" transform="rotate(-6 9.6 6.2)" />
    <ellipse cx="14.4" cy="6.2" rx="1.6" ry="2.3" transform="rotate(6 14.4 6.2)" />
    <ellipse cx="18.5" cy="9.5" rx="1.6" ry="2.2" transform="rotate(18 18.5 9.5)" />
    {/* Main metacarpal pad */}
    <path d="M12 11.2c-2.6 0-5.1 2.2-5.1 4.8 0 1.8 1.3 2.9 2.9 2.9.9 0 1.5-.4 2.2-.4s1.3.4 2.2.4c1.6 0 2.9-1.1 2.9-2.9 0-2.6-2.5-4.8-5.1-4.8z" />
  </svg>
);
