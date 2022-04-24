import {MavenArtifactListener} from './MavenArtifactListener.ts';
import {NpmArtifactListener} from './NpmArtifactListener.ts';
import {Artifact, ArtifactListener} from './ArtifactListener.ts';
import {PypiArtifactListener} from './PypiArtifactListener.ts';

const callback = (artifactListener: ArtifactListener<any>, artifacts: Artifact[]) => {
    const artifactListenerName = artifactListener.listenerName;
    artifacts.forEach(artifact => console.log(`${artifactListenerName} > ${artifact.id}: ${artifact.version}`));
};

[
    MavenArtifactListener,
    // NpmArtifactListener,
    PypiArtifactListener,
].forEach(artifactListenerClass => new artifactListenerClass(callback).start())

