// Serializes encrypted writes and prevents an old operation from resurrecting a removed vault.
export function createProfileWriter({ encrypt, write, onState = () => {} }) {
  let generation = 0, tail = Promise.resolve(), failure = null;
  return {
    enqueue(profile, password, message = '') {
      const snapshot = structuredClone(profile), secret = password, version = generation;
      onState('saving');
      tail = tail.then(async () => {
        if (version !== generation) return;
        const vault = await encrypt(snapshot, secret);
        if (version !== generation) return;
        write(vault);
        failure = null;
        onState('saved', message);
      }).catch(error => {
        if (version !== generation) return;
        failure = error;
        onState('failed', error.message);
      });
      return tail;
    },
    async flush() {
      let pending;
      do { pending = tail; await pending; } while (pending !== tail);
      if (failure) throw failure;
    },
    invalidate() { generation += 1; failure = null; },
  };
}