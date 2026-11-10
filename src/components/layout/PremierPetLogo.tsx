import React from 'react';

interface PremierPetLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
}

export const PremierPetLogo: React.FC<PremierPetLogoProps> = ({ 
  className = '', 
  size = 'md',
  showSubtitle = true
}) => {
  const heights = {
    sm: 'h-7',
    md: 'h-9',
    lg: 'h-12',
    xl: 'h-16'
  };

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
        <div className="flex items-center gap-1.5 mt-1 px-0.5">
          <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase">
            Almoxarifado & PDM Industrial
          </span>
          <span className="text-[9px] font-mono font-semibold px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
            TOTVS
          </span>
        </div>
      )}
    </div>
  );
};
