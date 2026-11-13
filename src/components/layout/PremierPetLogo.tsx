import React from 'react';

interface PremierPetLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  compact?: boolean;
}

export const PremierPetLogo: React.FC<PremierPetLogoProps> = ({ 
  className = '', 
  size = 'md',
  showSubtitle = true,
  compact = false,
}) => {
  const heights = {
    sm: 'h-7',
    md: 'h-9',
    lg: 'h-12',
    xl: 'h-16'
  };

  if (compact) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <img
          src="/assets/aistudio/Logotipo_PremieRpet__ea5ddac0.png"
          alt="PremieRpet - Tempo de Nutrir. De Verdade."
          className="h-7 max-w-[54px] w-auto object-contain shrink-0"
        />
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-start ${className}`}>
      <div className="flex items-center gap-2">
        <img
          src="/assets/aistudio/Logotipo_PremieRpet__ea5ddac0.png"
          alt="PremieRpet - Tempo de Nutrir. De Verdade."
          className={`${heights[size]} w-auto object-contain shrink-0`}
        />
      </div>

      {showSubtitle && (
        <div className="mt-1 px-0.5">
          <span className="text-[10px] font-mono font-bold tracking-tight text-slate-500 block leading-tight whitespace-nowrap">
            Almoxarifado de peças - PDM Industrial
          </span>
        </div>
      )}
    </div>
  );
};
