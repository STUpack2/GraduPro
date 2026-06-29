import React from 'react';

const BackgroundWithGlow = () => {
  return (
    <div className="fixed inset-0 w-full h-full z-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Pure white background */}
      <div className="absolute inset-0 bg-white" />
      
      {/* Subtle gradient at the bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-gray-50 to-transparent" />
      
      {/* Even smaller and more transparent glows */}
      <div className="absolute top-[15%] -left-[5%] w-[40%] h-[40%] rounded-full bg-gradient-to-br from-blue-400/40 via-blue-400/30 to-blue-300/20 blur-xl opacity-50 pointer-events-none" />
      <div className="absolute -bottom-[5%] -right-[5%] w-[35%] h-[35%] rounded-full bg-gradient-to-tr from-indigo-400/30 to-purple-400/30 blur-xl opacity-50 pointer-events-none" />
    </div>
  );
};

export default BackgroundWithGlow;
