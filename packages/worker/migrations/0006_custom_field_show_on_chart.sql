-- 0006_custom_field_show_on_chart.sql
-- Opt-in flag for surfacing a custom field's value inside the org chart
-- (packages/ui/src/components/person/PersonNode.tsx). Defaults to 0 so
-- existing fields stay hidden until the workspace owner explicitly opts
-- them in via the fields settings UI. Rendering order on the node
-- follows the existing `sort_order` on the same table — no separate
-- column needed.

ALTER TABLE custom_field_definitions
  ADD COLUMN show_on_chart INTEGER NOT NULL DEFAULT 0;
