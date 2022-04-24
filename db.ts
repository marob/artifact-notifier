import { Database, DataTypes, Model, SQLite3Connector } from 'https://deno.land/x/denodb@v1.0.40/mod.ts';

const connector = new SQLite3Connector({
    filepath: './database.sqlite',
});

const db = new Database(connector);

class User extends Model {
    static table = 'user';
    static fields = {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        email: { type: DataTypes.STRING, unique: true, allowNull: false }
    };
}
export class ListenerSequence extends Model {
    static table = 'listener-sequence';
    static fields = {
        id: { type: DataTypes.STRING, primaryKey: true, allowNull: false },
        value: { type: DataTypes.STRING, allowNull: false }
    };
}

await db.link([User, ListenerSequence]);
// await db.sync({ drop: true });

try {
    await db.sync();
} catch (e) {
    console.log('DB already synced...');
}

// await User.create([{
//     id: 1,
//     email: 'marob@smile.fr'
// }])

// console.log(await User.all());

