-- ============================================================================
-- 0002_invitations.sql
-- 招待受諾用の SECURITY DEFINER 関数を追加
--   - accept_invitation(p_token)             : 同 org 招待の受諾
--   - accept_cross_org_invitation(p_token)   : クロス組織招待の受諾
-- いずれも認証済ユーザーが自分の auth.uid() を起点に処理する。
-- ============================================================================

create or replace function public.accept_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv invitation;
  v_now timestamptz := now();
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;

  select * into v_inv from invitation where token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invitation_not_found');
  end if;
  if v_inv.accepted_at is not null then
    return jsonb_build_object('ok', false, 'error', 'already_accepted');
  end if;
  if v_inv.expires_at < v_now then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  update app_user
     set org_id = v_inv.org_id,
         role = v_inv.role
   where id = auth.uid();

  update invitation set accepted_at = v_now where id = v_inv.id;

  return jsonb_build_object('ok', true, 'org_id', v_inv.org_id, 'role', v_inv.role);
end$$;

grant execute on function public.accept_invitation(text) to authenticated;


create or replace function public.accept_cross_org_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv cross_org_invitation;
  v_user_org_id uuid;
  v_now timestamptz := now();
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;

  select * into v_inv from cross_org_invitation where token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invitation_not_found');
  end if;
  if v_inv.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'not_pending', 'status', v_inv.status);
  end if;
  if v_inv.expires_at < v_now then
    update cross_org_invitation set status = 'expired' where id = v_inv.id;
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  select org_id into v_user_org_id from app_user where id = auth.uid();
  if v_user_org_id is null then
    return jsonb_build_object('ok', false, 'error', 'user_no_org');
  end if;
  if v_user_org_id = v_inv.host_org_id then
    return jsonb_build_object('ok', false, 'error', 'cannot_accept_own_invitation');
  end if;

  insert into org_relation (host_org_id, guest_org_id, project_id, permissions, is_active)
  values (v_inv.host_org_id, v_user_org_id, v_inv.project_id, v_inv.permissions, true)
  on conflict (host_org_id, guest_org_id, project_id)
    do update set permissions = excluded.permissions, is_active = true;

  update cross_org_invitation
     set status = 'accepted', responded_at = v_now
   where id = v_inv.id;

  return jsonb_build_object(
    'ok', true,
    'host_org_id', v_inv.host_org_id,
    'guest_org_id', v_user_org_id,
    'project_id', v_inv.project_id
  );
end$$;

grant execute on function public.accept_cross_org_invitation(text) to authenticated;
