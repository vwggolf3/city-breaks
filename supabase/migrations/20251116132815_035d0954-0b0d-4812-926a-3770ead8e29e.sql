-- Enhance profile creation logic and ensure trigger exists
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first text;
  v_last text;
  v_full text;
  v_parts text[];
  v_gender text;
  v_avatar text;
begin
  -- Prefer explicit fields, fallback to full_name/name split
  v_first := coalesce(new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'given_name');
  v_last  := coalesce(new.raw_user_meta_data->>'last_name',  new.raw_user_meta_data->>'family_name');
  v_full  := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name');

  if ((v_first is null or v_last is null) and v_full is not null) then
    v_parts := regexp_split_to_array(trim(v_full), '\s+');
    if v_first is null and array_length(v_parts, 1) >= 1 then
      v_first := v_parts[1];
    end if;
    if v_last is null and array_length(v_parts, 1) >= 2 then
      v_last := array_to_string(v_parts[2:array_length(v_parts,1)], ' ');
    end if;
  end if;

  v_gender := new.raw_user_meta_data->>'gender';
  v_avatar := coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture');

  insert into public.profiles (id, first_name, last_name, gender, avatar_url)
  values (
    new.id,
    v_first,
    v_last,
    v_gender,
    v_avatar
  )
  on conflict (id) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    gender = excluded.gender,
    avatar_url = excluded.avatar_url;

  return new;
end;
$$;

-- Ensure trigger is present on auth.users to populate profiles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();