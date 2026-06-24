const MODULE_TO_MITRE = {
  sqli: { id: 'T1190', name: 'Exploit Public-Facing Application' },
  xss: { id: 'T1059', name: 'Command and Scripting Interpreter' },
  'sensitive-files': { id: 'T1213', name: 'Data from Information Repositories' },
  'admin-panels': { id: 'T1110', name: 'Brute Force' },
  headers: { id: 'T1592', name: 'Gather Victim Host Information' },
  cookies: { id: 'T1592', name: 'Gather Victim Host Information' },
  ssl: { id: 'T1592', name: 'Gather Victim Host Information' },
  'tech-detect': { id: 'T1592', name: 'Gather Victim Host Information' },
};

async function recordMitreCoverage(userId, results, supabase) {
  if (!supabase || !userId) return;
  for (const [moduleName, result] of Object.entries(results)) {
    if (!result?.vulns?.length) continue;
    const technique = MODULE_TO_MITRE[moduleName];
    if (!technique) continue;

    try {
      const { data: existing } = await supabase
        .from('mitre_coverage')
        .select('count')
        .eq('user_id', userId)
        .eq('technique_id', technique.id)
        .single();

      await supabase.from('mitre_coverage').upsert({
        user_id: userId,
        technique_id: technique.id,
        technique_name: technique.name,
        count: (existing?.count || 0) + 1,
        last_seen: new Date(),
      });
    } catch {}
  }
}

module.exports = { recordMitreCoverage, MODULE_TO_MITRE };
