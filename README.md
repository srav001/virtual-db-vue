# virtual-db-vue

## Currently a work in progress.

Most of the core features are working, except for some like keeping in sync with a backend DB.

## A type safe virtual database to be used in the front-end
The virtual database would let you interact with state (store) on the front-end as if it were a DB while keeping the reactivity of stores depending on the framework. 

Inspired by lowstore, this can be use full if you are primarily a backend engineer building a application, want a simple method to interact with state wiuthout worrying about reactivity or if you want read/write segregation when using your stores. 

This acts as a wrapper having adapters for multiple state management libraries to keep reactivity in the respective frameworks. As such the virtual-db-vue will be using pinia under the hood. 