-- Workspace membership is sensitive authorization data.
-- A signed-in user may only read their own memberships; all mutations happen
-- through controlled server-side administration, not directly from the browser.

ALTER TABLE public.user_workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for user_workspaces" ON public.user_workspaces;
DROP POLICY IF EXISTS "user_workspaces_select_own" ON public.user_workspaces;

CREATE POLICY "user_workspaces_select_own"
  ON public.user_workspaces
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

REVOKE ALL ON TABLE public.user_workspaces FROM anon;
GRANT SELECT ON TABLE public.user_workspaces TO authenticated;
