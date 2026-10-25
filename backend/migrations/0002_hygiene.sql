DROP TABLE IF EXISTS board_card_assignees;
DROP TABLE IF EXISTS board_card_labels;
DROP TABLE IF EXISTS board_checklist_items;
DROP TABLE IF EXISTS board_comments;
DROP TABLE IF EXISTS board_cards;
DROP TABLE IF EXISTS board_columns;
DROP TABLE IF EXISTS board_labels;
DROP TABLE IF EXISTS board_boards;

CREATE INDEX IF NOT EXISTS idx_links_user_created ON links(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_link_created ON analytics(link_id, created_at);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_email ON org_members(email);
CREATE INDEX IF NOT EXISTS idx_events_org_id ON events(org_id);
CREATE INDEX IF NOT EXISTS idx_dp_campaigns_org_id ON dp_campaigns(org_id);
CREATE INDEX IF NOT EXISTS idx_dp_frames_campaign_position ON dp_frames(campaign_id, position);
CREATE INDEX IF NOT EXISTS idx_check_ins_attendee_actioned ON check_ins(attendee_id, actioned_at);
