import {ListenerSequence} from './db.ts';

export interface ArtifactId {
    id: string;
}

export interface Artifact extends ArtifactId {
    version: string;
}

export abstract class ArtifactListener<T extends string | number> {
    callback: (artifactIds: ArtifactId[]) => void;
    abstract defaultSequence: T;
    sequence!: T;
    readonly listenerName = this.constructor.name;

    constructor(callback: (artifactListener: ArtifactListener<T>, artifacts: Artifact[]) => void) {
        this.callback = async (artifactIds: ArtifactId[]) => {
            const artifacts = await Promise.all(
                artifactIds.filter(artifactId => !this.filterOutArtifact(artifactId))
                    .map(artifactId => this.getArtifactDetails(artifactId))
            );
            // TODO: because of possible asynchronous retrieval of full artifacts from their ids, there is not guarantee that this code of the callback is executed in the same order as the callback have been called
            if (artifacts.length) {
                callback(this, artifacts);
            }
            await this.updateSequence(artifactIds);
        }
    }

    private async updateSequence(artifactIds: ArtifactId[]) {
        this.sequence = this.computeNextSequence(artifactIds);
        const currentSequence = await this.getSequence();
        if (currentSequence !== this.sequence) {
            await ListenerSequence.where('id', this.listenerName).update('value', this.sequence);
            // console.log(`Updated ${this.listenerName} sequence to ${this.sequence}`);
        }
    }

    private async getSequence(): Promise<T | undefined> {
        const value = (await ListenerSequence.find(this.listenerName))?.value as string;
        if (value) {
            const intValue = Number.parseInt(value);
            return (isNaN(intValue) ? value : intValue) as T;
        }
        return undefined;
    }

    async start(): Promise<void> {
        const currentSequence = await this.getSequence();
        if (currentSequence !== undefined) {
            this.sequence = currentSequence;
            console.log(`Resuming ${this.listenerName} at sequence ${this.sequence}`);
        } else {
            this.sequence = this.defaultSequence;
            console.log(`Initializing ${this.listenerName} sequence to ${this.sequence}`);
            await ListenerSequence.create({id: this.listenerName, value: '' + this.sequence});
        }
    }

    abstract computeNextSequence(artifacts: ArtifactId[]): T;

    filterOutArtifact(artifactId: ArtifactId): boolean {
        return false;
    }

    abstract getArtifactDetails(artifact: ArtifactId): Promise<Artifact>;
}
