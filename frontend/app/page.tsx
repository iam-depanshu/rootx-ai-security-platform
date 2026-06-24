"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/chat');
  }, [router]);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#060b18',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Orbitron', monospace",
      color: '#00FF9C',
      fontSize: '1.2rem',
      letterSpacing: '0.2em',
    }}>
      Loading RootX...
    </div>
  );
}