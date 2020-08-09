<template>
  <textarea @input='debounceInput' :value='value' spellcheck='false' class='editor'/>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import _ from 'lodash'

@Component

export default class Editor extends Vue {
  input = ''
  @Prop() private value: object

  timeout = null;
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  debounceInput (e) {
    clearTimeout(this.timeout)

    this.timeout = setTimeout(() => {
      this.$emit('change', e.target.value)
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
  padding 1em
  color white
  font-weight bolder
  font-family monospace

</style>
