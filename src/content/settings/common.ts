/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2012 Justin Samuel
 * Copyright (c) 2014 Martin Kimmerle
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 *
 * You should have received a copy of the GNU General Public License along with
 * this program. If not, see <http://www.gnu.org/licenses/>.
 *
 * ***** END LICENSE BLOCK *****
 */

import { BackgroundPage } from "main";

const {WinEnv, elManager, $id} = (() => {
  const {
    Environment,
    MainEnvironment,
  } = (browser.extension.getBackgroundPage() as any) as typeof BackgroundPage;

  // ===========================================================================

  // create a new Environment for this window
  const rvWinEnv = new Environment(MainEnvironment, "WinEnv");
  // The Environment has to be shut down when the content window gets unloaded.
  rvWinEnv.shutdownOnUnload(window);
  // start up right now, as there won't be any startup functions
  rvWinEnv.startup();
  const rvElManager = rvWinEnv.elManager;

  const rv$id = window.document.getElementById.bind(window.document);

  return {
    $id: rv$id,
    WinEnv: rvWinEnv,
    elManager: rvElManager,
  };
})();

export {WinEnv, elManager, $id};
