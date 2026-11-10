import { createContext } from "react";
import type { Skill } from "./model";
export const SkillOptionsContext = createContext<Skill[]>([]);
