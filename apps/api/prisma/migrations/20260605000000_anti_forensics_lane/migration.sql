-- Anti-Forensics lane. Sits between malware_analysis and
-- mobile_forensics in the enum order so it groups with the
-- offensive-content lanes the analyst needs to recognise (you
-- did the malware triage; now what did the attacker do to make
-- the rest of your job harder?). Matching anti_forensics
-- SkillArea ordered after malware_analysis.

ALTER TYPE "Lane" ADD VALUE 'anti_forensics' BEFORE 'mobile_forensics';

ALTER TYPE "SkillArea" ADD VALUE 'anti_forensics' AFTER 'malware_analysis';
