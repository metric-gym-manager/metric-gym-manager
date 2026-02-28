export function LogoTicker() {
  // Placeholder logos - using text placeholders instead of actual logo images
  const logos = [
    'FitZone Gym',
    'PowerHouse Fitness',
    'Iron Temple',
    'Muscle Factory',
    'Elite Athletics',
    'Strong & Lean',
    'Peak Performance',
    'Total Fitness',
  ];

  return (
    <div className="w-full py-8 overflow-hidden bg-gray-50">
      <div className="relative">
        {/* Gradient overlays for fade effect */}
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-gray-50 to-transparent z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-gray-50 to-transparent z-10" />

        {/* Scrolling container - contains 2 sets of logos for seamless loop */}
        <div className="flex gap-12 animate-scroll-left">
          {/* First set */}
          {logos.map((logo, index) => (
            <div
              key={`logo-1-${index}`}
              className="flex-shrink-0 flex items-center justify-center px-6 py-4 grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
            >
              <span className="text-2xl font-bold text-gray-600 whitespace-nowrap">
                {logo}
              </span>
            </div>
          ))}
          {/* Second set (duplicate for seamless loop) */}
          {logos.map((logo, index) => (
            <div
              key={`logo-2-${index}`}
              className="flex-shrink-0 flex items-center justify-center px-6 py-4 grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
            >
              <span className="text-2xl font-bold text-gray-600 whitespace-nowrap">
                {logo}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
