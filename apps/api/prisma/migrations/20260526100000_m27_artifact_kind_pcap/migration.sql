-- M27: add `pcap` to the ArtifactKind enum so scenarios can ship
-- packet-capture artefacts as a download-able artifact kind.

ALTER TYPE "ArtifactKind" ADD VALUE IF NOT EXISTS 'pcap';
