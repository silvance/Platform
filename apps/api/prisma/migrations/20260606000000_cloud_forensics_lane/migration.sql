-- Cloud Forensics lane. Sits between mobile_forensics and
-- rf_awareness in the lane order so it groups with the
-- specialized-triage lanes (memory / malware / anti-forensics /
-- mobile / cloud are all "things you triage from an unfamiliar
-- artifact substrate"). Matching cloud_forensics SkillArea
-- ordered after anti_forensics.

ALTER TYPE "Lane" ADD VALUE 'cloud_forensics' BEFORE 'rf_awareness';

ALTER TYPE "SkillArea" ADD VALUE 'cloud_forensics' AFTER 'anti_forensics';
