type ManagementListener = (info: any) => void;

type AddonID = string;
type AddonName = string;
type BaseUri = string;

type Origin = string;
type Dest = string;
type OriginRule = [Origin, null];
type DestRule = [null, Dest];
type OriginToDestRule = [Origin, Dest];
type Rule = OriginRule | DestRule | OriginToDestRule;

type RawTopLevelDocTranslationRule = [Origin, Dest];
interface ITopLevelDocTranslationInfo {
  extensionIds: AddonID[];
  translatedUri: Dest;
}

type ForEachCallback = (info: any) => void;

declare const browser: any;
