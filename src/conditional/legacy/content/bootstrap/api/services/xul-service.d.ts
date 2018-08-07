/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2018 Martin Kimmerle
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

interface IMaybeIncompleteXulElementSpec {
  attributes?: {
    [attributeName: string]: string;
  };
  children?: IMaybeIncompleteXulElementSpec[];
  events?: {};
  tag: string;
}
interface IMaybeIncompleteXulTree
    extends IMaybeIncompleteXulElementSpec {
  parent: {id: string} | {special: SpecialParentSpec};
}

interface IXulElementSpec extends IMaybeIncompleteXulElementSpec {
  attributes: {
    [attributeName: string]: string;
    id: string;
  };
  children?: IXulElementSpec[];
}
interface IXulTree extends IXulElementSpec {
  parent: {id: string} | {special: SpecialParentSpec};
}

interface IMaybeIncompleteXulTreeLists {
  [name: string]: IMaybeIncompleteXulTree[];
}
interface IXulTreeLists { [name: string]: IXulTree[]; }

interface ISubobjectParentSpec {
  id: string;
  type: "subobject";
  tree: string[];
}
interface IWindowParentSpec {
  type: "__window__";
}
type SpecialParentSpec = ISubobjectParentSpec | IWindowParentSpec;

type RootOrNonrootXulElementSpec = IXulElementSpec | IXulTree;
type MaybeIncompleteRootOrNonrootXulElementSpec =
    IMaybeIncompleteXulElementSpec | IMaybeIncompleteXulTree;
