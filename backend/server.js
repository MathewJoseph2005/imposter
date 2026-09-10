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
      role: participant.player_role || (participant.is_imposter ? 'Imposter' : 'Specialist')
    }));

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

    const teamMap = {};
    allTeams.forEach((team) => {
      teamMap[team.id] = team;
    });

    const participantsByTeam = {};
    allParticipants.forEach((participant) => {
      if (!participantsByTeam[participant.team_id]) {
        participantsByTeam[participant.team_id] = [];
      }
      participantsByTeam[participant.team_id].push(participant);
    });

    const teamIds = Object.keys(participantsByTeam);
    const selectedImposters = [];

    for (const teamId of teamIds) {
      const teamMembers = [...participantsByTeam[teamId]].sort(() => Math.random() - 0.5);
      if (teamMembers.length === 0) {
        continue;
      }

      const imposter = teamMembers[0];
      selectedImposters.push(imposter);
    }

    if (selectedImposters.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No participants available for shuffle.'
      });
    }

    const imposterIds = new Set(selectedImposters.map((member) => member.id));
    const remainingParticipants = allParticipants.filter((participant) => !imposterIds.has(participant.id));

    const groups = Array.from({ length: selectedImposters.length }, (_, index) => ({
      groupName: `Group ${index + 1}`,
      imposter: selectedImposters[index],
      members: [selectedImposters[index]]
    }));

    let assigned = false;
    let attempt = 0;

    while (!assigned && attempt < 200) {
      attempt += 1;

      const workingGroups = groups.map((group) => ({
        groupName: group.groupName,
        imposter: group.imposter,
        members: [group.imposter]
      }));

      const specialists = [...remainingParticipants].sort(() => Math.random() - 0.5);
      let validLayout = true;

      for (const specialist of specialists) {
        const eligibleGroups = workingGroups.filter((group) => {
          const hasSpace = group.members.length < 4;
          const sameTeamAsImposter = group.imposter.team_id === specialist.team_id;
          const sameTeamAlreadyPresent = group.members.some((member) => member.team_id === specialist.team_id);
          return hasSpace && !sameTeamAsImposter && !sameTeamAlreadyPresent;
        });

        if (eligibleGroups.length === 0) {
          validLayout = false;
          break;
        }

        const chosenGroup = eligibleGroups[Math.floor(Math.random() * eligibleGroups.length)];
        chosenGroup.members.push(specialist);
      }

      if (validLayout && workingGroups.every((group) => group.members.length === 4)) {
        assigned = true;
        groups.splice(0, groups.length, ...workingGroups);
      }
    }

    if (!assigned) {
      return res.status(400).json({
        success: false,
        message: 'Unable to create a valid seating arrangement for all teams.'
      });
    }

    const updates = [];
    groups.forEach((group) => {
      group.members.forEach((member) => {
        updates.push({
          id: member.id,
          is_imposter: member.id === group.imposter.id,
          shuffle_group: group.groupName,
          player_role: member.id === group.imposter.id ? 'Imposter' : 'Specialist'
        });
      });
    });

    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('participants')
        .update({
          is_imposter: update.is_imposter,
          shuffle_group: update.shuffle_group,
          player_role: update.player_role
        })
        .eq('id', update.id);

      if (updateError) {
        return res.status(500).json({ success: false, message: updateError.message });
      }
    }

    return res.status(200).json({
      success: true,
      imposters_selected: selectedImposters.length,
      groups_created: groups.length
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Shuffle could not be started.' });
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
