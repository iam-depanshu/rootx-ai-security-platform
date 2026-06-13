// // import { connectDB } from "@/lib/mongodb";  // ADD THIS LINE
// // export async function POST(req: Request) {
// //   const body = await req.json();

// //   const target = body.target;
  

// //   try {

// //     const response = await fetch(target);
// //     const html = await response.text();

// // const technologies: string[] = [];
// // const threats = [];
// // const vulnerabilities: {
// //   name: string;
// //   severity: string;
// //   detail: string;
// // }[] = [];
// // const adminPaths = [
// //   "/admin",
// //   "/login",
// //   "/dashboard",
// //   "/wp-admin",
// //   "/phpmyadmin",
// // ];

// // const discoveredPanels = [];

// // for (const path of adminPaths) {

// //   try {

// //     const panelRes = await fetch(
// //       `${target}${path}`
// //     );

// //     if (panelRes.status === 200) {

// //       discoveredPanels.push(path);

// //         vulnerabilities.push({
// //         name: "Exposed Admin Panel",
// //         severity: "HIGH",
// //         detail:
// //           `Administrative interface exposed at ${path}`,
// //       });

// //     }

// //   } catch (error) {

// //     console.log(error);

// //   }

// // }

// // // WordPress Risks
// // if (
// //   technologies.includes("WordPress")
// // ) {

// //   threats.push({
// //     technology: "WordPress",
// //     risk:
// //       "Outdated plugins may allow remote code execution",
// //     severity: "HIGH",
// //     cve: "CVE-2023-1234",
// //   });

// // }

// // // jQuery
// // if (
// //   technologies.includes("jQuery")
// // ) {

// //   threats.push({
// //     technology: "jQuery",
// //     risk:
// //       "Older jQuery versions vulnerable to XSS",
// //     severity: "MEDIUM",
// //     cve: "CVE-2020-11022",
// //   });

// // }

// // // Apache
// // if (
// //   technologies.includes("Apache")
// // ) {

// //   threats.push({
// //     technology: "Apache",
// //     risk:
// //       "Potential server version disclosure risk",
// //     severity: "LOW",
// //     cve: "CVE-2021-41773",
// //   });

// // }

// // // nginx
// // if (
// //   technologies.includes("nginx")
// // ) {

// //   threats.push({
// //     technology: "nginx",
// //     risk:
// //       "Check for outdated nginx modules",
// //     severity: "LOW",
// //     cve: "CVE-2019-20372",
// //   });

// // }

// // // React
// // if (
// //   technologies.includes("React")
// // ) {

// //   threats.push({
// //     technology: "React",
// //     risk:
// //       "Potential dependency vulnerabilities",
// //     severity: "LOW",
// //     cve: "CVE-2022-23648",
// //   });

// // }

// // // jQuery Risks
// // if (
// //   technologies.includes("jQuery")
// // ) {

// //   threats.push({
// //     technology: "jQuery",
// //     risk: "Older jQuery versions vulnerable to XSS",
// //     severity: "MEDIUM",
// //   });

// // }

// // // Apache Risks
// // if (
// //   technologies.includes("Apache")
// // ) {

// //   threats.push({
// //     technology: "Apache",
// //     risk: "Potential server version disclosure",
// //     severity: "LOW",
// //   });

// // }

// // // nginx Risks
// // if (
// //   technologies.includes("nginx")
// // ) {

// //   threats.push({
// //     technology: "nginx",
// //     risk: "Check for outdated nginx modules",
// //     severity: "LOW",
// //   });

// // }
// // // Next.js
// // if (
// //   technologies.includes("Next.js")
// // ) {

// //   threats.push({
// //     technology: "Next.js",
// //     risk:
// //       "Check for exposed environment variables and API routes",
// //     severity: "MEDIUM",
// //     cve: "CVE-2020-5284",
// //   });

// // }

// // // Cloudflare
// // if (
// //   technologies.includes("Cloudflare")
// // ) {

// //   threats.push({
// //     technology: "Cloudflare",
// //     risk:
// //       "Reverse proxy detected — origin exposure should be verified",
// //     severity: "LOW",
// //     cve: "CVE-2021-44228",
// //   });

// // }

// // // React
// // if (
// //   technologies.includes("React")
// // ) {

// //   threats.push({
// //     technology: "React",
// //     risk:
// //       "Potential dependency vulnerabilities detected",
// //     severity: "LOW",
// //     cve: "CVE-2022-23648",
// //   });

// // }

// // // Detect Server
// // const server = response.headers.get("server");

// // if (server) {

// //   if (server.toLowerCase().includes("nginx")) {
// //     technologies.push("nginx");
// //   }

// //   if (server.toLowerCase().includes("apache")) {
// //     technologies.push("Apache");
// //   }

// // }

// // // Detect React
// // if (
// //   html.toLowerCase().includes("react")
// // ) {
// //   technologies.push("React");
// // }

// // // Detect Next.js
// // if (
// //   html.toLowerCase().includes("_next")
// // ) {
// //   technologies.push("Next.js");
// // }

// // // Detect WordPress
// // if (
// //   html.toLowerCase().includes("wp-content")
// // ) {
// //   technologies.push("WordPress");
// // }

// // // Detect jQuery
// // if (
// //   html.toLowerCase().includes("jquery")
// // ) {
// //   technologies.push("jQuery");
// // }

// // // Detect Cloudflare
// // const cf = response.headers.get("server");

// // if (
// //   cf &&
// //   cf.toLowerCase().includes("cloudflare")
// // ) {
// //   technologies.push("Cloudflare");
// // }

// //     const cookieHeader =
// //   response.headers.get("set-cookie");

// // // Check HttpOnly
// // if (
// //   cookieHeader &&
// //   !cookieHeader.includes("HttpOnly")
// // ) {

// //   vulnerabilities.push({
// //     name: "Missing HttpOnly Cookie",
// //     severity: "HIGH",
// //     detail:
// //       "Cookies can be accessed via JavaScript",
// //   });

// // }

// // // Check Secure Flag
// // if (
// //   cookieHeader &&
// //   !cookieHeader.includes("Secure")
// // ) {

// //   vulnerabilities.push({
// //     name: "Missing Secure Cookie Flag",
// //     severity: "MEDIUM",
// //     detail:
// //       "Cookies may be transmitted over HTTP",
// //   });

// // }

// // // Check SameSite
// // if (
// //   cookieHeader &&
// //   !cookieHeader.includes("SameSite")
// // ) {

// //   vulnerabilities.push({
// //     name: "Missing SameSite Protection",
// //     severity: "MEDIUM",
// //     detail:
// //       "Application may be vulnerable to CSRF attacks",
// //   });

// // }

// //     // CSP
// //     const csp = response.headers.get(
// //       "content-security-policy"
// //     );

// //     if (!csp) {

// //       vulnerabilities.push({
// //         name: "Missing CSP Header",
// //         severity: "MEDIUM",
// //         detail:
// //           "No Content-Security-Policy header detected",
// //       });

// //     }

// //     // HSTS
// //     const hsts = response.headers.get(
// //       "strict-transport-security"
// //     );

// //     if (!hsts) {

// //       vulnerabilities.push({
// //         name: "Missing HSTS Protection",
// //         severity: "HIGH",
// //         detail:
// //           "Strict-Transport-Security header missing",
// //       });

// //     }

// //     // HTTPS Check
// //     if (!target.startsWith("https://")) {

// //       vulnerabilities.push({
// //         name: "Insecure HTTP",
// //         severity: "CRITICAL",
// //         detail:
// //           "Website is not using HTTPS encryption",
// //       });

// //     }
// // let sslGrade = "A";
// // let sslStatus = "SECURE";

// // // HTTPS Check
// // if (!target.startsWith("https://")) {

// //   sslGrade = "F";

// //   sslStatus = "INSECURE";

// //   vulnerabilities.push({
// //     name: "HTTPS Not Enabled",
// //     severity: "CRITICAL",
// //     detail:
// //       "Website is using insecure HTTP protocol",
// //   });

// // }

// // // Weak SSL Simulation
// // const weakTls = false;

// // if (weakTls) {

// //   sslGrade = "C";

// //   sslStatus = "WEAK TLS";

// //   vulnerabilities.push({
// //     name: "Weak TLS Configuration",
// //     severity: "HIGH",
// //     detail:
// //       "TLS 1.0 / TLS 1.1 detected",
// //   });

// // }
// //     let score = 100;

// //     score -= vulnerabilities.length * 10;
// //     const status = score >= 70 ? "SAFE" : score >= 40 ? "AT RISK" : "CRITICAL"; // ✅ define status
// //     const db = await connectDB();
// // await db.collection("scans").insertOne({     // ✅ remove the extra ()
// //   score,
// //   status,
// //   vulnerabilities,
// //   technologies,
// //   threats,
// //   discoveredPanels,
// //   sslGrade,
// //   sslStatus,
// //   createdAt: new Date(),
// // });
// // return Response.json({

// //   score,

// //   status,

// //   vulnerabilities,

// //   technologies,

// //   threats,

// //   discoveredPanels,

// //   sslGrade,

// //   sslStatus,

// //   createdAt: new Date(),

// // });

// //   } catch (error) {

// //     return Response.json({

// //       score: 0,

// //       status: "SCAN FAILED",

// //       vulnerabilities: [
// //         {
// //           name: "Connection Failed",
// //           severity: "CRITICAL",
// //           detail:
// //             "Unable to connect to target",
// //         },
// //       ],

// //     });

// //   }
// // }

// import { supabase } from "@/lib/supabase";

// export async function POST(req: Request) {
//   const body = await req.json();
//   const target = body.target;

//   try {
//     const response = await fetch(target);
//     const html = await response.text();

//     const technologies: string[] = [];
//     const threats: { technology: string; risk: string; severity: string; cve?: string }[] = [];
//     const vulnerabilities: { name: string; severity: string; detail: string }[] = [];
//     const adminPaths = ["/admin", "/login", "/dashboard", "/wp-admin", "/phpmyadmin"];
//     const discoveredPanels: string[] = [];

//     for (const path of adminPaths) {
//       try {
//         const panelRes = await fetch(`${target}${path}`);
//         if (panelRes.status === 200) {
//           discoveredPanels.push(path);
//           vulnerabilities.push({
//             name: "Exposed Admin Panel",
//             severity: "HIGH",
//             detail: `Administrative interface exposed at ${path}`,
//           });
//         }
//       } catch (error) {
//         console.log(error);
//       }
//     }

//     const server = response.headers.get("server");
//     if (server) {
//       if (server.toLowerCase().includes("nginx")) technologies.push("nginx");
//       if (server.toLowerCase().includes("apache")) technologies.push("Apache");
//       if (server.toLowerCase().includes("cloudflare")) technologies.push("Cloudflare");
//     }

//     if (html.toLowerCase().includes("react")) technologies.push("React");
//     if (html.toLowerCase().includes("_next")) technologies.push("Next.js");
//     if (html.toLowerCase().includes("wp-content")) technologies.push("WordPress");
//     if (html.toLowerCase().includes("jquery")) technologies.push("jQuery");

//     if (technologies.includes("WordPress"))
//       threats.push({ technology: "WordPress", risk: "Outdated plugins may allow remote code execution", severity: "HIGH", cve: "CVE-2023-1234" });
//     if (technologies.includes("jQuery"))
//       threats.push({ technology: "jQuery", risk: "Older jQuery versions vulnerable to XSS", severity: "MEDIUM", cve: "CVE-2020-11022" });
//     if (technologies.includes("Apache"))
//       threats.push({ technology: "Apache", risk: "Potential server version disclosure risk", severity: "LOW", cve: "CVE-2021-41773" });
//     if (technologies.includes("nginx"))
//       threats.push({ technology: "nginx", risk: "Check for outdated nginx modules", severity: "LOW", cve: "CVE-2019-20372" });
//     if (technologies.includes("Next.js"))
//       threats.push({ technology: "Next.js", risk: "Check for exposed environment variables and API routes", severity: "MEDIUM", cve: "CVE-2020-5284" });
//     if (technologies.includes("Cloudflare"))
//       threats.push({ technology: "Cloudflare", risk: "Reverse proxy detected — origin exposure should be verified", severity: "LOW" });
//     if (technologies.includes("React"))
//       threats.push({ technology: "React", risk: "Potential dependency vulnerabilities detected", severity: "LOW", cve: "CVE-2022-23648" });

//     const cookieHeader = response.headers.get("set-cookie");
//     if (cookieHeader && !cookieHeader.includes("HttpOnly"))
//       vulnerabilities.push({ name: "Missing HttpOnly Cookie", severity: "HIGH", detail: "Cookies can be accessed via JavaScript" });
//     if (cookieHeader && !cookieHeader.includes("Secure"))
//       vulnerabilities.push({ name: "Missing Secure Cookie Flag", severity: "MEDIUM", detail: "Cookies may be transmitted over HTTP" });
//     if (cookieHeader && !cookieHeader.includes("SameSite"))
//       vulnerabilities.push({ name: "Missing SameSite Protection", severity: "MEDIUM", detail: "Application may be vulnerable to CSRF attacks" });

//     if (!response.headers.get("content-security-policy"))
//       vulnerabilities.push({ name: "Missing CSP Header", severity: "MEDIUM", detail: "No Content-Security-Policy header detected" });
//     if (!response.headers.get("strict-transport-security"))
//       vulnerabilities.push({ name: "Missing HSTS Protection", severity: "HIGH", detail: "Strict-Transport-Security header missing" });

//     const sslGrade = target.startsWith("https://") ? "A" : "F";
//     const sslStatus = target.startsWith("https://") ? "SECURE" : "INSECURE";
//     if (!target.startsWith("https://"))
//       vulnerabilities.push({ name: "Insecure HTTP", severity: "CRITICAL", detail: "Website is not using HTTPS encryption" });

//     let score = 100;
//     score -= vulnerabilities.length * 10;
//     if (score < 0) score = 0;

//     const status = score >= 70 ? "SAFE" : score >= 40 ? "AT RISK" : "CRITICAL";

//     const { error } = await supabase.from("scans").insert({
//       score,
//       status,
//       vulnerabilities,
//       technologies,
//       threats,
//       discovered_panels: discoveredPanels,
//       ssl_grade: sslGrade,
//       ssl_status: sslStatus,
//       target,
//     });

//     if (error) {
//       console.error("❌ Supabase insert error:", error.message);
//     } else {
//       console.log("✅ Scan saved to Supabase!");
//     }

//     return Response.json({
//       score,
//       status,
//       vulnerabilities,
//       technologies,
//       threats,
//       discoveredPanels,
//       sslGrade,
//       sslStatus,
//     });

//   } catch (error) {
//     console.error("❌ Scan error:", error);
//     return Response.json({
//       score: 0,
//       status: "SCAN FAILED",
//       vulnerabilities: [{ name: "Connection Failed", severity: "CRITICAL", detail: "Unable to connect to target" }],
//     });
//   }
// }
import { exec } from "child_process";
import util from "util";
import { supabase } from "@/lib/supabase";

const execPromise = util.promisify(exec);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const target = body.target;

    if (!target) {
      return Response.json({
        error: "Target URL required",
      });
    }

    // -------------------------
    // BASIC FETCH
    // -------------------------
    console.log("STEP 1 → Fetching target");
    const response = await fetch(target);
    console.log("STEP 2 → Target fetched");
    const html = await response.text();

    const vulnerabilities: any[] = [];
    const technologies: string[] = [];
    const threats: any[] = [];

    // -------------------------
    // HEADER CHECKS
    // -------------------------

    const csp = response.headers.get("content-security-policy");

    if (!csp) {
      vulnerabilities.push({
        name: "Missing CSP Header",
        severity: "MEDIUM",
        detail: "Content Security Policy missing",
      });
    }

    const hsts = response.headers.get("strict-transport-security");

    if (!hsts) {
      vulnerabilities.push({
        name: "Missing HSTS",
        severity: "HIGH",
        detail: "Strict Transport Security missing",
      });
    }

    // -------------------------
    // TECHNOLOGY DETECTION
    // -------------------------

    if (html.includes("_next")) {
      technologies.push("Next.js");
    }

    if (html.includes("wp-content")) {
      technologies.push("WordPress");
    }

    if (html.includes("jquery")) {
      technologies.push("jQuery");
    }

    // -------------------------
    // REAL ZAP SCAN
    // -------------------------
   try {

  console.log("STEP 3 → Fetching ZAP alerts");

  const zapAlerts = await Promise.race([

    // axios.get(
    //   `http://127.0.0.1:8080/JSON/core/view/alerts/?baseurl=${target}`
    // ),

    new Promise((_, reject) =>
      setTimeout(() => reject("ZAP Timeout"), 3000)
    ),

  ]);

  const alerts =
    (zapAlerts as any).data.alerts || [];

  alerts.forEach((alert: any) => {

    vulnerabilities.push({
      name: alert.alert,
      severity: alert.risk || "MEDIUM",
      detail: alert.description || "Security issue detected",
    });

  });

  console.log("STEP 4 → ZAP completed");

} catch (zapError) {

  console.log("ZAP ERROR:", zapError);

}

    // -------------------------
    // REAL NMAP SCAN
    // -------------------------
    console.log("STEP 5 → Starting Nmap");
    let openPorts: any[] = [];

    try {

      const hostname = new URL(target).hostname;

      const { stdout } = await execPromise(
         `nmap -F ${hostname}`
      );
      openPorts = stdout
  .split("\n")
  .filter((line) => line.includes("/tcp"))
  .map((line) => {

    const parts = line.trim().split(/\s+/);

    return {
      port: parts[0],
      service: parts[2] || "unknown",
      protocol: "tcp",
    };

  });
    } catch (nmapError) {
      console.log("NMAP ERROR:", nmapError);
    }

    // -------------------------
    // SCORE
    // -------------------------

    let score = 100;

    score -= vulnerabilities.length * 5;

    if (score < 0) {
      score = 0;
    }

    const status =
      score >= 70
        ? "SAFE"
        : score >= 40
        ? "AT RISK"
        : "CRITICAL";

    // -------------------------
    // SAVE TO SUPABASE
    // -------------------------
    console.log("STEP 7 → Saving to Supabase");
    const { error } = await supabase
      .from("scans")
      .insert({
        target,
        score,
        status,
        vulnerabilities,
        technologies,
        threats,
        open_ports: openPorts,
      });
      console.log("STEP 8 → Supabase save complete");
    if (error) {
      console.log(error);
    }

    return Response.json({
      target,
      score,
      status,
      vulnerabilities,
      technologies,
      threats,
      openPorts,
    });

  } catch (error) {

    console.log(error);

    return Response.json({
      error: "Scan failed",
    });
  }
}