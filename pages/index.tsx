import { Splitpanes, Pane } from 'splitpanes'
import {
  Ref,
  computed,
  defineComponent,
  onMounted,
  reactive,
  ref,
  nextTick,
  watch,
} from 'vue'
import RemoveIcon from '@/components/icons/removeIcon.vue'
import Editor from '@/components/Editor/Editor.vue'
import Preview from '@/components/Preview/Preview'
import Card from '@/components/Card/Card'
import Add from '@/components/icons/add.vue'
import { registerCompile, transFormCode } from '~/utils/compile-helper'
import { useDebounce } from '@/hooks/useDebounce'
import { mulSplit } from '@cc-heart/utils'
import 'splitpanes/dist/splitpanes.css'
import '@/assets/scss/components/playground.scss'

export default defineComponent({
  name: 'Playground',
  setup() {
    const entry = 'app.js'
    const html = ref('')
    const addScriptTagRef = ref<HTMLInputElement | null>(null)
    const isAddScriptVisible = ref(false)
    const style = ref('')
    const scriptModule = reactive(new Map())
    scriptModule.set(entry, `// ${entry}`)
    const currentPage = ref(entry)
    const splitCode = '__FE-PLAYGROUND__'

    const handleChange = (event: string, refs: Ref<string>) => {
      refs.value = event
    }
    const script = computed(() => {
      return scriptModule.get(currentPage.value) || ''
    })

    const scriptNames = computed(() => [...scriptModule.keys()])
    const compileModule = ref({})

    const handleChangeCompileModule = useDebounce(async () => {
      const newCode = await transFormCode(Object.fromEntries(scriptModule))
      Reflect.set(compileModule, 'value', newCode)
    }, 500)
    const handleChangeScripts = async (event: string) => {
      scriptModule.set(currentPage.value, event)
      handleChangeCompileModule()
    }

    const handleBlur = (event: Event) => {
      isAddScriptVisible.value = false
      let value: string = Reflect.get(event.target || {}, 'value')
      if (value) {
        if (!value.endsWith('.js')) {
          value += '.js'
        }
        scriptModule.set(value, `// ${value}`)
      }
    }

    const handleRemoveTag = (name: string, e: MouseEvent) => {
      if (scriptModule.has(name)) {
        if (currentPage.value === name) {
          const ind = scriptNames.value.findIndex((val) => val === name)
          if (ind !== 0) {
            currentPage.value = scriptNames.value[ind - 1]
          }
        }
        scriptModule.delete(name)
        handleChangeCompileModule()
        e.stopPropagation()
      }
    }

    watch(
      () => isAddScriptVisible.value,
      (bool) => {
        if (bool) {
          nextTick(() => {
            const el = addScriptTagRef.value
            if (el) {
              el.focus?.()
            }
          })
        }
      },
    )

    const handlerKeydownEnter = (e: KeyboardEvent) => {
      if (e.key === 'Enter') handleBlur(e)
    }

    const compilerBase64 = () => {
      let compileStr = ''
      compileStr += `html:${html.value}` + splitCode
      compileStr += `style:${style.value}` + splitCode
      for (const [key, value] of scriptModule) {
        compileStr += `${key}:${value}` + splitCode
      }
      return btoa(compileStr)
    }

    registerCompile(compilerBase64)

    watch([html, scriptModule, style], () => {
      compilerBase64()
    })

    const handleChangeCurrentScripts = (name: string) => {
      currentPage.value = name
    }

    onMounted(() => {
      const result = location.hash.match(/[^#].*/g)?.[0]
      if (result) {
        const str = atob(result)
        const modules = str.split(new RegExp(splitCode, 'g')).filter(Boolean)
        modules.forEach((module) => {
          // eslint-disable-next-line prefer-const
          let [key, value] = mulSplit(module, ':', 1)
          if (!key) return
          value ??= ''
          if (key === 'html') {
            html.value = value
          } else if (key === 'style') {
            style.value = value
          } else {
            scriptModule.set(key, value || '')
          }
        })
      }
      handleChangeCompileModule()
    })

    return () => (
      <div class="p-3 w-full h-full box-border flex items-center justify-center">
        <client-only fallbackTag={'span'} fallback={'Loading....'}>
          <Splitpanes class="default-theme">
            <Pane>
              <Splitpanes class="default-theme" horizontal>
                <Pane>
                  <Card v-slots={{ title: () => 'html' }}>
                    <Editor
                      lang="html"
                      value={html.value}
                      onChange={(e: string) => handleChange(e, html)}
                    />
                  </Card>
                </Pane>
                <Pane>
                  <Card
                    v-slots={{
                      title: () => (
                        <div class="flex items-center">
                          <div>
                            {scriptNames.value.map((val) => {
                              return (
                                <span
                                  onClick={() =>
                                    handleChangeCurrentScripts(val)
                                  }
                                  class={`script-tag relative ${currentPage.value === val
                                    ? 'active-script'
                                    : ''
                                    }`}
                                >
                                  {val}
                                  {val === 'app.js' ? null : (
                                    <RemoveIcon
                                      class="absolute top-3px right--2px"
                                      onClick={(e: MouseEvent) =>
                                        handleRemoveTag(val, e)
                                      }
                                    />
                                  )}
                                </span>
                              )
                            })}
                          </div>
                          {isAddScriptVisible.value && (
                            <input
                              ref={(ref) => {
                                if (ref instanceof HTMLInputElement)
                                  addScriptTagRef.value = ref
                              }}
                              autofocus
                              class="add-script-tag"
                              onBlur={handleBlur}
                              onKeypress={handlerKeydownEnter}
                            ></input>
                          )}
                          <Add
                            onClick={() => (isAddScriptVisible.value = true)}
                          />
                        </div>
                      ),
                    }}
                  >
                    <Editor
                      value={script.value}
                      onChange={(e: string) => handleChangeScripts(e)}
                    />
                  </Card>
                </Pane>
                <Pane>
                  <Card v-slots={{ title: () => 'style' }}>
                    <Editor
                      lang="css"
                      value={style.value}
                      onChange={(e: string) => handleChange(e, style)}
                    />
                  </Card>
                </Pane>
              </Splitpanes>
            </Pane>
            <Pane class="h-full">
              <Card v-slots={{ title: () => 'output' }}>
                <Preview
                  compileModule={compileModule.value}
                  entry={entry}
                  html={html.value}
                  style={style.value}
                />
              </Card>
            </Pane>
          </Splitpanes>
        </client-only>
      </div>
    )
  },
})