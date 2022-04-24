import {Artifact, ArtifactId, ArtifactListener} from './ArtifactListener.ts';

const NB_ROWS_PER_PAGE = 20;
const POLLING_TIME_IN_MS = 60 * 1000;

export class MavenArtifactListener extends ArtifactListener<number> {
    defaultSequence = Date.now();

    async start() {
        await super.start();
        await this.sync();
    }

    getArtifactDetails(artifact: ArtifactId): Promise<Artifact> {
        const mavenArtifact = artifact as MavenArtifact;
        return Promise.resolve({
            id: mavenArtifact.id,
            version: mavenArtifact.latestVersion // FIXME
        });
    }

    private async sync() {
        let artifacts = [];
        try {
            artifacts = await this.getSince();
        } catch (e) {
            console.error(`${this.listenerName} > Error while querying API`, e);
        }
        this.callback(artifacts);
        setTimeout(() => this.sync(), POLLING_TIME_IN_MS);
    }

    private async getSince(): Promise<any[]> {
        const artifacts = [];
        let foundArtifactsNumber = 0;

        do {
            // if (artifacts.length > 0) {
            //     console.log(`Downloading page ${1 + artifacts.length / NB_ROWS_PER_PAGE}/${Math.ceil(foundArtifactsNumber / NB_ROWS_PER_PAGE)}...`);
            // }
            const jsonData: Response = await this.getSinceStart(artifacts.length);
            if (artifacts.length === 0) {
                foundArtifactsNumber = jsonData.response.numFound;
                // if (foundArtifactsNumber > 0) {
                //     console.log(`Found ${foundArtifactsNumber} new artifacts since ${new Date(sequence).toLocaleString()}`);
                // }
            }
            artifacts.push(...jsonData.response.docs);
        } while (artifacts.length < foundArtifactsNumber)
        return artifacts;
    }

    computeNextSequence(artifacts: MavenArtifact[]): number {
        return Math.max(...artifacts.map(artifact => artifact.timestamp), this.sequence);
    }

    private async getSinceStart(start = 0): Promise<Response> {
        const url = `https://search.maven.org/solrsearch/select?q=timestamp:%7B${this.sequence}%20TO%20*%7D&rows=${NB_ROWS_PER_PAGE}&start=${start}&wt=json`;
        return await (await fetch(url, {signal: AbortSignal.timeout(5000)})).json();
    }
}

export interface MavenArtifact extends ArtifactId {
    id: string;
    g: string;
    a: string;
    latestVersion: string;
    repositoryId: string;
    p: string;
    timestamp: number;
    versionCount: number;
    text: string[];
    ec: string[];
}

interface Response {
    responseHeader: {
        status: number;
        QTime: number;
        params: {
            q: string;
            core: string;
            spellcheck: string;
            indent: string;
            fl: string;
            start: string;
            sort: string;
            'spellcheck.count': string,
            rows: string,
            wt: string;
            version: string;
        }
    }
    response: {
        numFound: number;
        start: number;
        docs: MavenArtifact[]
    }
    spellcheck: {
        suggestion: any[]
    }
}
