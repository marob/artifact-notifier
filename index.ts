export interface ArtifactId {
    id: string;
}

export interface ArtifactListener {
    start: (callback: (artifact: ArtifactId) => void) => void;
}

