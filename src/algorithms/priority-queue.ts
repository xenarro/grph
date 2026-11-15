// A binary heap: items kept as a tree in an array, every parent no bigger than its children,
// so the smallest item is always at index 0. Adding an item or taking the smallest one moves it
// up or down one branch of the tree: log2(size) steps, about 17 for 100,000 items.

export class PriorityQueue<T> {
    private readonly items: T[] = [];

    // `before(a, b)` is true when a comes out first
    constructor(private readonly before: (a: T, b: T) => boolean) {}

    get size(): number {
        return this.items.length;
    }

    push(item: T): void {
        const { items } = this;
        items.push(item);
        let child = items.length - 1;
        while (child > 0) {
            const parent = (child - 1) >> 1;
            if (!this.before(items[child], items[parent])) {
                break;
            }
            [items[child], items[parent]] = [items[parent], items[child]];
            child = parent;
        }
    }

    // takes out the smallest item
    pop(): T | undefined {
        const { items } = this;
        const top = items[0];
        const last = items.pop();
        if (items.length > 0 && last !== undefined) {
            items[0] = last;
            let parent = 0;
            for (;;) {
                const left = parent * 2 + 1;
                const right = left + 1;
                let smallest = parent;
                if (left < items.length && this.before(items[left], items[smallest])) {
                    smallest = left;
                }
                if (right < items.length && this.before(items[right], items[smallest])) {
                    smallest = right;
                }
                if (smallest === parent) {
                    break;
                }
                [items[parent], items[smallest]] = [items[smallest], items[parent]];
                parent = smallest;
            }
        }
        return top;
    }
}
