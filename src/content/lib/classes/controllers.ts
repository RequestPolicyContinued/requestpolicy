/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2017 Martin Kimmerle
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

export interface IController {
  startupPreconditions?: Array<Promise<void>>;
  startup?: () => void;
  shutdown?: () => void;
}

export class Controllers {
  private controllers: IController[];

  constructor(aControllers: IController[]) {
    this.controllers = aControllers;
  }

  public shutdown() {
    this.controllers.reverse().forEach((controller) => {
      if (typeof controller.shutdown === "function") {
        controller.shutdown();
      }
    });
  }

  public startup() {
    this.controllers.forEach((controller) => {
      if (typeof controller.startup === "function") {
        if (typeof controller.startupPreconditions !== "undefined") {
          Promise.all(controller.startupPreconditions).
              then(controller.startup).
              catch((e) => {
                console.error("controller startup");
                console.dir(e);
              });
        } else {
          controller.startup();
        }
      }
    });
  }
}
