import { create } from "zustand";

export type ProjectFormat = "reel" | "longform";
export type ProjectStatus = "draft" | "planned" | "generating" | "ready" | "archived";

export interface Project {
  id: string;
  title: string;
  source_story: string;
  format: ProjectFormat;
  language: string;
  target_duration_sec: number;
  aspect_ratio: string;
  deity_theme: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

interface ProjectState {
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  currentProject: null,
  setCurrentProject: (project) => set({ currentProject: project }),
}));
