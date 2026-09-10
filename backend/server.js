const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { scoreRepository } = require('./aiScorer');

console.log('SUPABASE_URL loaded:', !!process.env.SUPABASE_URL);
console.log('SUPABASE_KEY loaded:', !!process.env.SUPABASE_KEY);

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.log('Missing Supabase environment variables.');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const normalizeGitHubUrl = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const validGitHubUrl = (value) => {
  const url = normalizeGitHubUrl(value);
  return /^https?:\/\/(www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/i.test(url);
};

const generateTeamCode = (teamName) => {
  const prefix = String(teamName || '').trim().slice(0, 3).toUpperCase();
  const randomDigits = String(Math.floor(1000 + Math.random() * 9000));
  return `${prefix}${randomDigits}`;
};

app.get('/', (req, res) => {
  res.json({ message: 'Asthra Imposter Backend Running 🚀' });
});

app.post('/api/register-team', async (req, res) => {
  try {
    const team_name = String(req.body?.team_name || '').trim();
    const members = Array.isArray(req.body?.members) ? req.body.members : [];

    if (!team_name) {
      return res.status(400).json({
        success: false,
        message: 'team_name is required.'
      });
    }

    const cleanMembers = members
      .map((member) => String(member || '').trim())
      .filter((member) => member.length > 0);

    if (cleanMembers.length !== 4) {
      return res.status(400).json({
        success: false,
        message: 'Exactly 4 non-empty member names are required.'
      });
    }

    const existingTeam = await supabase
      .from('teams')
      .select('id, team_name')
      .ilike('team_name', team_name)
      .limit(1);

    if (existingTeam.error) {
      return res.status(500).json({ success: false, message: existingTeam.error.message });
    }

    if (existingTeam.data && existingTeam.data.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Team name already exists.'
      });
    }

    const teamCode = generateTeamCode(team_name);

    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .insert([
        {
          team_name,
          team_code: teamCode
        }
      ])
      .select();

    if (teamError) {
      return res.status(500).json({ success: false, message: teamError.message });
    }

    const teamId = teamData?.[0]?.id;
    if (!teamId) {
      return res.status(500).json({ success: false, message: 'Team could not be created.' });
    }

    const participantsToInsert = cleanMembers.map((memberName) => ({
      team_id: teamId,
      participant_name: memberName
    }));

    const { error: participantsError } = await supabase
      .from('participants')
      .insert(participantsToInsert);

    if (participantsError) {
      await supabase.from('teams').delete().eq('id', teamId);
      return res.status(500).json({ success: false, message: participantsError.message });
    }

    return res.status(201).json({
      success: true,
      team_code: teamCode,
      message: 'Team registered successfully.'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Team registration failed.' });
  }
});

app.get('/api/registered-teams', async (req, res) => {
  try {
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('*')
      .order('id', { ascending: true });

    if (teamsError) {
      return res.status(500).json({ success: false, message: teamsError.message });
    }

    const { data: participants, error: participantsError } = await supabase
      .from('participants')
      .select('*')
      .order('id', { ascending: true });

    if (participantsError) {
      return res.status(500).json({ success: false, message: participantsError.message });
    }

    const participantsByTeam = {};
    (participants || []).forEach((participant) => {
      if (!participantsByTeam[participant.team_id]) {
        participantsByTeam[participant.team_id] = [];
      }
      participantsByTeam[participant.team_id].push(participant.participant_name);
    });

    const teamsWithMembers = (teams || []).map((team) => ({
      id: team.id,
      team_name: team.team_name,
      team_code: team.team_code,
      members: participantsByTeam[team.id] || []
    }));

    return res.status(200).json({
      success: true,
      teams: teamsWithMembers,
      total_teams: teamsWithMembers.length,
      total_participants: (participants || []).length
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Unable to fetch registered teams.' });
  }
});

app.get('/api/shuffle-layout', async (req, res) => {
  try {
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, team_name')
      .order('id', { ascending: true });

    if (teamsError) {
      return res.status(500).json({ success: false, message: teamsError.message });
    }

    const { data: participants, error: participantsError } = await supabase
      .from('participants')
      .select('*')
      .order('id', { ascending: true });

    if (participantsError) {
      return res.status(500).json({ success: false, message: participantsError.message });
    }

    // Validate: must have exactly 6 complete teams with 24 participants total
    const completeTeams = (teams || []).filter((team) => {
      const memberCount = (participants || []).filter((p) => p.team_id === team.id).length;
      return memberCount === 4;
    });

    if (!teams || teams.length !== 6 || completeTeams.length !== 6 || (participants || []).length !== 24) {
      return res.status(200).json({
        success: true,
        participants: [],
        seating_ready: false
      });
    }

    // Check that shuffle has actually been run (all participants have a shuffle_group assigned)
    const shuffled = (participants || []).every((p) => p.shuffle_group && p.shuffle_group !== 'Unassigned');
    if (!shuffled) {
      return res.status(200).json({
        success: true,
        participants: [],
        seating_ready: false
      });
    }

    const teamMap = {};
    (teams || []).forEach((team) => {
      teamMap[team.id] = team.team_name;
    });

    const seatRows = (participants || []).map((participant) => ({
      id: participant.id,
      participant_name: participant.participant_name,
      original_team: teamMap[participant.team_id] || 'Unknown Team',
      seating_group: participant.shuffle_group,
      // Use player_role as primary truth — is_imposter boolean may be null/unset in some DB rows
      is_imposter: participant.player_role === 'Imposter' || participant.is_imposter === true,
      role: (participant.player_role === 'Imposter' || participant.is_imposter === true) ? 'Imposter' : 'Specialist'
    }));

    // Sort: within each group, specialists come first (rows 1-3), imposter always last (row 4).
    seatRows.sort((a, b) => {
      // Primary: group name (Group 1, Group 2 … Group 6 — numeric sort)
      const gA = parseInt((a.seating_group || '').replace(/\D/g, ''), 10) || 0;
      const gB = parseInt((b.seating_group || '').replace(/\D/g, ''), 10) || 0;
      if (gA !== gB) return gA - gB;
      // Secondary: specialists (is_imposter=false → 0) before imposter (true → 1)
      return (a.is_imposter ? 1 : 0) - (b.is_imposter ? 1 : 0);
    });

    return res.status(200).json({
      success: true,
      participants: seatRows,
      seating_ready: true
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Unable to fetch seating layout.' });
  }
});

app.post('/api/authenticate', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const team_name = String(req.body?.team_name || '').trim();

    if (!name || !team_name) {
      return res.status(400).json({
        success: false,
        message: 'Both name and team_name are required.'
      });
    }

    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .select('id, team_name, team_code')
      .eq('team_name', team_name)
      .maybeSingle();

    if (teamError) {
      return res.status(500).json({ success: false, message: teamError.message });
    }

    if (!teamData) {
      return res.status(404).json({
        success: false,
        message: 'Invalid Team or Participant Name.'
      });
    }

    // Only select the fields needed — never expose group, original team mapping, or teammates
    const { data: participantData, error: participantError } = await supabase
      .from('participants')
      .select('id, participant_name, player_role, shuffle_group')
      .eq('team_id', teamData.id)
      .eq('participant_name', name)
      .maybeSingle();

    if (participantError) {
      return res.status(500).json({ success: false, message: participantError.message });
    }

    if (!participantData) {
      return res.status(404).json({
        success: false,
        message: 'Invalid Team or Participant Name.'
      });
    }

    // Require shuffle to have been run before login is allowed
    if (!participantData.player_role || !participantData.shuffle_group) {
      return res.status(403).json({
        success: false,
        message: 'The event has not started yet. Please wait for the coordinator to run the shuffle.'
      });
    }

    // Normalise role: treat any non-Imposter role as Specialist
    const role = participantData.player_role === 'Imposter' ? 'Imposter' : 'Specialist';

    // Return only what the participant needs — no group number, no team mapping
    return res.status(200).json({
      success: true,
      message: 'Authentication successful.',
      user: {
        id: participantData.id,
        name: participantData.participant_name,
        team_name: teamData.team_name,
        team_code: teamData.team_code,
        role: role
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Authentication failed.' });
  }
});

app.post('/api/start-shuffle', async (req, res) => {
  try {
    const { data: allTeams, error: teamsError } = await supabase
      .from('teams')
      .select('id, team_name, team_code');

    if (teamsError) {
      return res.status(500).json({ success: false, message: teamsError.message });
    }

    const { data: allParticipants, error: participantsError } = await supabase
      .from('participants')
      .select('*');

    if (participantsError) {
      return res.status(500).json({ success: false, message: participantsError.message });
    }

    if (!Array.isArray(allTeams) || allTeams.length === 0) {
      return res.status(400).json({ success: false, message: 'No teams registered.' });
    }

    // ── Validate: exactly 6 complete teams ────────────────────────────────────
    const teamMap = {};
    allTeams.forEach((team) => { teamMap[team.id] = team; });

    const participantsByTeam = {};
    allParticipants.forEach((p) => {
      if (!participantsByTeam[p.team_id]) participantsByTeam[p.team_id] = [];
      participantsByTeam[p.team_id].push(p);
    });

    const teamIds = Object.keys(participantsByTeam);
    if (teamIds.length !== 6 || teamIds.some((tid) => participantsByTeam[tid].length !== 4)) {
      return res.status(400).json({
        success: false,
        message: 'Exactly 6 teams with 4 members each are required to run the shuffle.'
      });
    }

    // ── Step A: Pick exactly 1 random imposter per original team ─────────────
    // Shuffle each team's member list and take the first element as imposter.
    const imposters = [];
    const specialistsByTeam = {};   // team_id → [3 remaining specialists]

    for (const teamId of teamIds) {
      const shuffled = [...participantsByTeam[teamId]].sort(() => Math.random() - 0.5);
      imposters.push(shuffled[0]);
      specialistsByTeam[teamId] = shuffled.slice(1);   // the other 3
    }

    // ── Step B: Shuffle imposters into random group order ─────────────────────
    const shuffledImposters = [...imposters].sort(() => Math.random() - 0.5);

    // ── Step C: Build 6 groups — each starts empty (no pre-seeded imposter) ──
    // We'll assign specialists first, then place each imposter at the end.
    const groups = Array.from({ length: 6 }, (_, i) => ({
      groupName:  `Group ${i + 1}`,
      imposter:   shuffledImposters[i],
      specialists: []              // will hold exactly 3 specialists
    }));

    // Flatten all 18 specialists into one pool
    const allSpecialists = [];
    for (const teamId of teamIds) {
      allSpecialists.push(...specialistsByTeam[teamId]);
    }

    // ── Step D: Assign specialists (retry loop, up to 500 attempts) ───────────
    // Rule: a specialist must not share an original team with the group's imposter
    //       OR with any other specialist already in that group.
    let assigned = false;
    let attempt  = 0;

    while (!assigned && attempt < 500) {
      attempt++;

      const working = groups.map((g) => ({
        groupName:   g.groupName,
        imposter:    g.imposter,
        specialists: []
      }));

      const pool = [...allSpecialists].sort(() => Math.random() - 0.5);
      let valid  = true;

      for (const specialist of pool) {
        // Eligible groups: have space (< 3 specialists) AND no team conflict
        const eligible = working.filter((wg) => {
          if (wg.specialists.length >= 3) return false;
          if (wg.imposter.team_id === specialist.team_id) return false;
          if (wg.specialists.some((s) => s.team_id === specialist.team_id)) return false;
          return true;
        });

        if (eligible.length === 0) { valid = false; break; }

        const chosen = eligible[Math.floor(Math.random() * eligible.length)];
        chosen.specialists.push(specialist);
      }

      if (valid && working.every((wg) => wg.specialists.length === 3)) {
        assigned = true;
        working.forEach((wg, i) => { groups[i].specialists = wg.specialists; });
      }
    }

    if (!assigned) {
      return res.status(400).json({
        success: false,
        message: 'Unable to create a valid seating arrangement after 500 attempts. This should not happen with 6 teams of 4. Check for duplicate team memberships.'
      });
    }

    // ── Step 1: Write participants table (is_imposter, shuffle_group, player_role) ──
    for (const group of groups) {
      // Specialists
      for (const member of group.specialists) {
        const { error: updateError } = await supabase
          .from('participants')
          .update({
            is_imposter:   false,
            shuffle_group: group.groupName,
            player_role:   'Specialist'
          })
          .eq('id', member.id);

        if (updateError) {
          return res.status(500).json({ success: false, message: updateError.message });
        }
      }

      // Imposter
      const { error: impUpdateError } = await supabase
        .from('participants')
        .update({
          is_imposter:   true,
          shuffle_group: group.groupName,
          player_role:   'Imposter'
        })
        .eq('id', group.imposter.id);

      if (impUpdateError) {
        return res.status(500).json({ success: false, message: impUpdateError.message });
      }
    }

    // ── Step 2: Load main_event_tasks ────────────────────────────────────────
    const { data: tasks, error: tasksError } = await supabase
      .from('main_event_tasks')
      .select('*')
      .order('task_number', { ascending: true });

    if (tasksError || !tasks || tasks.length < 3) {
      return res.status(200).json({
        success: true,
        imposters_selected: 6,
        groups_created:     6,
        assignments_written: false,
        assignments_note:   'main_event_tasks table missing or empty — run supabase_migration.sql first.'
      });
    }

    // ── Step 3: Clear previous assignments ───────────────────────────────────
    const { error: deleteError } = await supabase
      .from('main_event_assignments')
      .delete()
      .neq('id', 0);

    if (deleteError) {
      return res.status(500).json({ success: false, message: deleteError.message });
    }

    // ── Step 4: Build assignment rows ─────────────────────────────────────────
    // Task mapping: Groups 1 & 4 → Task 1, Groups 2 & 5 → Task 2, Groups 3 & 6 → Task 3
    const taskForGroup = (groupName) => {
      const match   = groupName.match(/\d+/);
      const groupNum = match ? parseInt(match[0], 10) : 1;
      const taskNum  = ((groupNum - 1) % 3) + 1;
      return tasks.find((t) => t.task_number === taskNum) || tasks[0];
    };

    // Slot data lookup — specialists get person1/2/3 work; imposter ALWAYS gets person4_secret
    const slotData = (task, slot) => {
      const map = {
        1: { role_name: task.person1_title, work_description: task.person1_work },
        2: { role_name: task.person2_title, work_description: task.person2_work },
        3: { role_name: task.person3_title, work_description: task.person3_work },
        4: { role_name: task.person4_title, work_description: task.person4_secret }
      };
      return map[slot] || map[1];
    };

    const assignmentRows = [];

    for (const group of groups) {
      const task = taskForGroup(group.groupName);

      // Specialists → slots 1, 2, 3  (in their shuffled order within this group)
      group.specialists.forEach((member, idx) => {
        const slot = idx + 1;   // 1, 2, or 3
        const sd   = slotData(task, slot);
        const originalTeam = (teamMap[member.team_id] || {}).team_name || 'Unknown';

        assignmentRows.push({
          participant_id:    member.id,
          participant_name:  member.participant_name,
          original_team:     originalTeam,
          shuffled_group:    group.groupName,
          task_number:       task.task_number,
          task_title:        task.task_title,
          task_description:  task.task_description,
          person_slot:       slot,
          role_name:         sd.role_name,
          work_description:  sd.work_description,
          is_imposter:       false,
          github_repo:       null,
          submission_status: 'Pending',
          submitted_at:      null,
          ai_score:          null
        });
      });

      // Imposter → always slot 4
      const imp      = group.imposter;
      const impSd    = slotData(task, 4);
      const impTeam  = (teamMap[imp.team_id] || {}).team_name || 'Unknown';

      assignmentRows.push({
        participant_id:    imp.id,
        participant_name:  imp.participant_name,
        original_team:     impTeam,
        shuffled_group:    group.groupName,
        task_number:       task.task_number,
        task_title:        task.task_title,
        task_description:  task.task_description,
        person_slot:       4,
        role_name:         impSd.role_name,
        work_description:  impSd.work_description,   // person4_secret
        is_imposter:       true,
        github_repo:       null,
        submission_status: 'Pending',
        submitted_at:      null,
        ai_score:          null
      });
    }

    const { error: insertError } = await supabase
      .from('main_event_assignments')
      .insert(assignmentRows);

    if (insertError) {
      return res.status(500).json({ success: false, message: insertError.message });
    }

    return res.status(200).json({
      success:             true,
      imposters_selected:  6,
      groups_created:      6,
      assignments_written: true
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Shuffle could not be started.' });
  }
});

// ── GET /api/my-assignment/:participantId ────────────────────────────────────
// Returns the logged-in participant's task assignment.
// participantId is a UUID string — never parse as integer.
app.get('/api/my-assignment/:participantId', async (req, res) => {
  try {
    const participantId = String(req.params.participantId || '').trim();

    if (!participantId) {
      return res.status(400).json({ success: false, message: 'Valid participant_id is required.' });
    }

    const { data, error } = await supabase
      .from('main_event_assignments')
      .select(
        'participant_id, participant_name, original_team, shuffled_group, ' +
        'task_number, task_title, task_description, ' +
        'person_slot, role_name, work_description, is_imposter, ' +
        'github_repo, submission_status, submitted_at, ai_score'
      )
      .eq('participant_id', participantId)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'No assignment found. The coordinator may not have run the shuffle yet.'
      });
    }

    return res.status(200).json({ success: true, assignment: data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch assignment.' });
  }
});

// ── POST /api/submit-github ──────────────────────────────────────────────────
// Saves a participant's GitHub repository link into their assignment record.
// Prevents duplicate submissions.
// participant_id is a UUID string — never parse as integer.
app.post('/api/submit-github', async (req, res) => {
  try {
    const participant_id = String(req.body?.participant_id || '').trim();
    const github_repo    = normalizeGitHubUrl(req.body?.github_repo);

    if (!participant_id) {
      return res.status(400).json({ success: false, message: 'participant_id is required.' });
    }

    if (!github_repo || !validGitHubUrl(github_repo)) {
      return res.status(400).json({ success: false, message: 'Valid GitHub repository URL is required.' });
    }

    // Check assignment exists and has not already been submitted
    const { data: existing, error: fetchError } = await supabase
      .from('main_event_assignments')
      .select('participant_id, submission_status')
      .eq('participant_id', participant_id)
      .maybeSingle();

    if (fetchError) {
      return res.status(500).json({ success: false, message: fetchError.message });
    }

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Assignment not found for this participant.' });
    }

    if (existing.submission_status === 'Submitted') {
      return res.status(409).json({ success: false, message: 'You have already submitted. Only one submission is allowed.' });
    }

    const { error: updateError } = await supabase
      .from('main_event_assignments')
      .update({
        github_repo,
        submission_status: 'Submitted',
        submitted_at:      new Date().toISOString()
      })
      .eq('participant_id', participant_id);

    if (updateError) {
      return res.status(500).json({ success: false, message: updateError.message });
    }

    return res.status(200).json({ success: true, message: 'GitHub repository submitted successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Submission failed.' });
  }
});

app.get('/api/team-auth/:teamCode', async (req, res) => {
  try {
    const teamCode = String(req.params.teamCode || '').trim();

    if (!teamCode) {
      return res.status(400).json({ success: false, message: 'Team code is required.' });
    }

    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .select('*')
      .eq('team_code', teamCode)
      .single();

    if (teamError || !teamData) {
      return res.status(404).json({ success: false, message: 'Team not found.' });
    }

    const { data: participants, error: participantError } = await supabase
      .from('participants')
      .select('id, team_id, participant_name, shuffle_group, player_role')
      .eq('team_id', teamData.id);

    if (participantError) {
      return res.status(500).json({ success: false, message: participantError.message });
    }

    return res.status(200).json({
      success: true,
      team: {
        id: teamData.id,
        team_name: teamData.team_name,
        team_code: teamData.team_code
      },
      participants: participants || []
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Team authentication failed.' });
  }
});

app.post('/api/main-event-submit', async (req, res) => {
  try {
    const team_code = String(req.body?.team_code || '').trim();
    const participant_name = String(req.body?.participant_name || '').trim();
    const task_name = String(req.body?.task_name || '').trim();
    const github_link = normalizeGitHubUrl(req.body?.github_link);
    const elapsed_time = String(req.body?.elapsed_time || '').trim();

    if (!team_code || !participant_name || !task_name || !github_link || !elapsed_time) {
      return res.status(400).json({
        success: false,
        message: 'team_code, participant_name, task_name, github_link, and elapsed_time are required.'
      });
    }

    if (!validGitHubUrl(github_link)) {
      return res.status(400).json({
        success: false,
        message: 'Valid GitHub repository URL is required.'
      });
    }

    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .select('id')
      .eq('team_code', team_code)
      .single();

    if (teamError || !teamData) {
      return res.status(404).json({ success: false, message: 'Invalid team code.' });
    }

    const { data, error } = await supabase
      .from('main_event')
      .insert([
        {
          team_id: teamData.id,
          participant_name,
          task_name,
          github_link,
          elapsed_time,
          submitted_at: new Date().toISOString()
        }
      ])
      .select();

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.status(201).json({ success: true, data: data[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Main event submission failed.' });
  }
});

app.get('/api/test', async (req, res) => {
  try {
    const { data, error } = await supabase.from('teams').select('*');

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.status(200).json({ success: true, teams: data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch teams.' });
  }
});

app.get('/', (req, res) => {
  res.json({ message: 'Asthra Imposter Backend Running 🚀' });
});

app.post('/submit-main', async (req, res) => {
  try {
    const participant_name = String(req.body?.participant_name || '').trim();
    const task_name = String(req.body?.task_name || '').trim();
    const github_link = normalizeGitHubUrl(req.body?.github_link);

    if (!participant_name || !task_name || !github_link || !validGitHubUrl(github_link)) {
      return res.status(400).json({
        success: false,
        message: 'Valid participant_name, task_name, and GitHub repository URL are required.'
      });
    }

    const payload = {
      participant_name,
      task_name,
      github_link,
      submitted_time: new Date().toISOString(),
      status: 'Pending AI'
    };

    const { data, error } = await supabase
      .from('submissions_main')
      .insert([payload])
      .select();

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.status(201).json({ success: true, data: data[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Submission failed' });
  }
});

app.post('/submit-fizzbuzz', async (req, res) => {
  try {
    const participant_name = String(req.body?.participant_name || '').trim();
    const fizz_output = String(req.body?.fizz_output || '').trim();

    if (!participant_name || !fizz_output) {
      return res.status(400).json({
        success: false,
        message: 'participant_name and fizz_output are required.'
      });
    }

    const payload = {
      participant_name,
      fizz_output,
      submitted_time: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('submissions_fizzbuzz')
      .insert([payload])
      .select();

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.status(201).json({ success: true, data: data[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'FizzBuzz submission failed' });
  }
});

app.post('/submit-codeimposter', async (req, res) => {
  try {
    const team_name = String(req.body?.team_name || '').trim();

    if (!team_name) {
      return res.status(400).json({
        success: false,
        message: 'team_name is required.'
      });
    }

    const payload = {
      team_name,
      submitted_time: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('submissions_codeimposter')
      .insert([payload])
      .select();

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.status(201).json({ success: true, data: data[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Code Imposter submission failed' });
  }
});

app.get('/submissions', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('submissions_main')
      .select('*')
      .order('submitted_time', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch submissions' });
  }
});

app.get('/leaderboard', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('submissions_main')
      .select('participant_name, task_name, total_score, status')
      .order('total_score', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch leaderboard' });
  }
});

app.post('/score/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: submissionData, error: fetchError } = await supabase
      .from('submissions_main')
      .select('github_link')
      .eq('id', id)
      .single();

    if (fetchError || !submissionData?.github_link) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found or missing github_link.'
      });
    }

    const scoreResult = await scoreRepository(submissionData.github_link);

    const totalScore = Number(scoreResult.total_score || 0);

    const { data, error } = await supabase
      .from('submissions_main')
      .update({
        ui_score: Number(scoreResult.ui_score || 0),
        logic_score: Number(scoreResult.logic_score || 0),
        creativity_score: Number(scoreResult.creativity_score || 0),
        imposter_score: Number(scoreResult.imposter_score || 0),
        total_score: totalScore,
        ai_feedback: String(scoreResult.feedback || ''),
        status: 'Evaluated'
      })
      .eq('id', id)
      .select();

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.status(200).json({ success: true, data: data[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Scoring failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
