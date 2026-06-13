"use client";

import { useEffect } from "react";

export default function ProtectedPage() {

  useEffect(() => {
      const fetchAttack = async () => {
    try {
      const res = await fetch("/api/monitor");

      const data = await res.json();
      setLogs((prev) => [
  {
    ...data.attack,
    time: data.timestamp,
  },
  ...prev.slice(0, 4),
]);
    } catch (err) {
      console.log(err);
    }
  };

  fetchAttack();

  const interval = setInterval(fetchAttack, 4000);

  return () => clearInterval(interval);
}, []);

    async function run() {

    try {

      const payload = window.location.search;

      await fetch("/api/monitor", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          ip: "LIVE_USER",

          path: "/protected",

          payload,
        }),
      });

    } catch (error) {

      console.log(error);

    }

    // Redirect to Juice Shop
    window.location.href =
      "http://localhost:3001";

  }

    run();

  return (

    <div className="w-full h-screen flex items-center justify-center text-[#00FF9C] bg-black">

      Redirecting through RootX security layer...

    </div>

  );

}

function setLogs(arg0: (prev: any) => any[]) {
  throw new Error("Function not implemented.");
}
