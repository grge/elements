<template>
  <textarea @input='debounceInput' spellcheck='false' class='editor'/>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'
import _ from 'lodash'

@Component

export default class Editor extends Vue {
  input = ''

  timeout = null;
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  debounceInput (e) {
    clearTimeout(this.timeout)

    this.timeout = setTimeout(() => {
      this.input = e.target.value
    }, 500)
  }
}

</script>

<style scoped lang="stylus">
.editor
  height calc(100% -2px)
  border 0px
  background red
  resize none
  font-size 30px
</style>
