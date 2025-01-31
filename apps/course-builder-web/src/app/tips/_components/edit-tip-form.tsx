'use client'

import * as React from 'react'
import {TipPlayer} from '@/app/tips/_components/tip-player'
import {
  Button,
  Form,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from '@coursebuilder/ui'
import {useForm} from 'react-hook-form'
import {z} from 'zod'
import {zodResolver} from '@hookform/resolvers/zod'
import {Input} from '@coursebuilder/ui'
import {api} from '@/trpc/react'
import {useRouter} from 'next/navigation'
import {type Tip} from '@/lib/tips'
import {TipAssistant} from './tip-assistant'
import Link from 'next/link'
import {ImagePlusIcon, ZapIcon} from 'lucide-react'
import {CloudinaryUploadWidget} from './cloudinary-upload-widget'
import {CloudinaryMediaBrowser} from './cloudinary-media-browser'
import {cn} from '@/lib/utils'
import {FeedbackMarker} from '@/lib/feedback-marker'
import {useSocket} from '@/hooks/use-socket'
import {CodemirrorEditor} from '@/app/_components/codemirror'
import ReactMarkdown from 'react-markdown'

const NewTipFormSchema = z.object({
  title: z.string().min(2).max(90),
  body: z.string().optional().nullable(),
})

export function EditTipForm({tip}: {tip: Tip}) {
  const [feedbackMarkers, setFeedbackMarkers] = React.useState<
    FeedbackMarker[]
  >([])
  const router = useRouter()

  const {mutateAsync: generateFeedback} =
    api.writing.generateFeedback.useMutation()

  useSocket({
    room: tip._id,
    onMessage: async (messageEvent) => {
      try {
        const data = JSON.parse(messageEvent.data)
        const invalidateOn = ['ai.feedback.markers.generated']

        if (invalidateOn.includes(data.name)) {
          setFeedbackMarkers(data.body)
        }
      } catch (error) {
        // noting to do
      }
    },
  })

  const form = useForm<z.infer<typeof NewTipFormSchema>>({
    resolver: zodResolver(NewTipFormSchema),
    defaultValues: {
      title: tip.title,
      body: tip.body,
    },
  })
  const {mutateAsync: updateTip, status: updateTipStatus} =
    api.tips.update.useMutation()

  const onSubmit = async (values: z.infer<typeof NewTipFormSchema>) => {
    const updatedTip = await updateTip({tipId: tip._id, ...values})

    if (!updatedTip) {
      // handle edge case, e.g. toast an error message
    } else {
      const {slug} = updatedTip

      router.push(`/tips/${slug}`)
    }
  }

  const [activeToolbarTab, setActiveToolbarTab] = React.useState(
    TOOLBAR.values().next().value,
  )

  return (
    <Form {...form}>
      <form
        className="flex h-full flex-grow flex-col"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <div className="flex h-9 w-full items-center justify-between bg-muted px-1">
          <Button className="px-0" asChild variant="link">
            <Link href={`/tips/${tip.slug}`} className="aspect-square">
              ←
            </Link>
          </Button>
          <Button
            type="submit"
            variant="default"
            size="sm"
            className="h-7"
            disabled={updateTipStatus === 'loading'}
          >
            Save
          </Button>
        </div>
        <div className="flex h-full flex-grow border-t">
          <div className="grid grid-cols-12">
            <div className="col-span-3 flex h-full flex-col border-r">
              <TipPlayer
                videoResourceId={tip.videoResourceId}
                muxPlaybackId={tip.muxPlaybackId}
              />

              <FormField
                control={form.control}
                name="title"
                render={({field}) => (
                  <FormItem className="p-5">
                    <FormLabel className="text-lg font-bold">Title</FormLabel>
                    <FormDescription>
                      A title should summarize the tip and explain what it is
                      about clearly.
                    </FormDescription>
                    <Input {...field} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex max-h-screen items-end p-5 text-xs text-orange-600">
                {tip._id}
              </div>
              {tip.transcript ? (
                <div className="p-5">
                  <h3 className="font-bold">Transcript</h3>
                  <ReactMarkdown className="prose dark:prose-invert">
                    {tip.transcript}
                  </ReactMarkdown>
                </div>
              ) : null}
            </div>
            <div className="col-span-6 flex h-full w-full flex-col justify-start space-y-5 border-r">
              <FormField
                control={form.control}
                name="body"
                render={({field}) => (
                  <FormItem className="pt-5">
                    <FormLabel className="px-5 text-lg font-bold">
                      Content
                    </FormLabel>
                    <FormDescription className="px-5 pb-3">
                      Tip content in MDX.
                    </FormDescription>
                    <CodemirrorEditor
                      roomName={`${tip._id}`}
                      value={tip.body}
                      markers={feedbackMarkers}
                      onChange={(data) => {
                        form.setValue('body', data)

                        generateFeedback({
                          resourceId: tip._id,
                          body: data,
                          currentFeedback: feedbackMarkers,
                        })
                      }}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div>
                <ul>
                  {feedbackMarkers.map((marker) => {
                    return (
                      <li
                        key={marker.originalText}
                      >{`${marker.level}: ${marker.originalText} -> ${marker.fullSuggestedChange} [${marker.feedback}]`}</li>
                    )
                  })}
                </ul>
              </div>
            </div>
            <div className="col-span-3">
              {activeToolbarTab.id === 'assistant' && (
                <TipAssistant tip={tip} />
              )}
              {activeToolbarTab.id === 'media' && (
                <>
                  <CloudinaryUploadWidget dir={tip._type} id={tip._id} />
                  <CloudinaryMediaBrowser />
                </>
              )}
            </div>
          </div>
          <div className="border-l bg-muted">
            <div className="flex flex-col gap-1 p-1">
              <TooltipProvider delayDuration={0}>
                {Array.from(TOOLBAR).map((item) => (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="link"
                        type="button"
                        className={cn(
                          `flex aspect-square items-center justify-center rounded-lg border p-0 transition hover:bg-background/50`,
                          {
                            'border-border bg-background':
                              activeToolbarTab.id === item.id,
                            'border-transparent bg-transparent':
                              activeToolbarTab.id !== item.id,
                          },
                        )}
                        onClick={() => setActiveToolbarTab(item)}
                      >
                        {item.icon()}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="capitalize">
                      {item.id}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </TooltipProvider>
            </div>
          </div>
        </div>
      </form>
    </Form>
  )
}

const TOOLBAR = new Set([
  {
    id: 'assistant',
    icon: () => <ZapIcon strokeWidth={1.5} size={24} width={18} height={18} />,
  },
  {
    id: 'media',
    icon: () => (
      <ImagePlusIcon strokeWidth={1.5} size={24} width={18} height={18} />
    ),
  },
])
