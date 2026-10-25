-- Steps under each big goal in the Goals tab.
alter table private_items drop constraint if exists private_items_kind_check;
alter table private_items add constraint private_items_kind_check
  check (kind in ('pillar','ladder','step','pin','countdown','money'));
