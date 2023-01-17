import os
import shutil
import sys
import argparse
from bdtime import tt


dirname = 'shells'


def strtobool(val):
    """Convert a string representation of truth to true (1) or false (0).

    True values are 'y', 'yes', 't', 'true', 'on', and '1'; false values
    are 'n', 'no', 'f', 'false', 'off', and '0'.  Raises ValueError if
    'val' is anything else.
    """
    val = val.lower()
    if val in ('y', 'yes', 't', 'true', 'on', '1'):
        return 1
    elif val in ('n', 'no', 'f', 'false', 'off', '0', 'none', 'null'):
        return 0
    else:
        raise ValueError("invalid truth value %r" % (val,))


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--name", type=str, default="bode-shells",
                        help="the name of this experiment")
    # parser.add_argument("--seed", type=int, default=1,
    #                     help="seed of the experiment")
    # parser.add_argument("--float", type=float, default=1.2345,
    #                     help="float")
    parser.add_argument(
        '-mf', "--move-file", type=lambda x: bool(strtobool(x)), default=False, nargs="?", const=True,
        help="if toggled, program will auto move files to current work directory like forceManage.py."
    )

    parser.add_argument(
        '-ow', "--overwrite", type=lambda x: bool(strtobool(x)), default=False, nargs="?", const=True,
        help="强制覆盖脚本文件夹."
    )

    # parser.add_argument('-ls', '-list', action='append')      # 输入列表

    args = parser.parse_args()
    return args


def run():
    args = parse_args()

    if args.overwrite:
        if os.path.exists(dirname):
            print(f'*** 将强制覆盖{dirname}!')
            tt.sleep(1)
            shutil.rmtree(dirname)
    assert not os.path.exists(dirname), f'脚本文件夹[{dirname}]已存在!'

    # from bdtime import show_json
    # show_json(args.__dict__)
    # return

    # 保存凭证
    cmd = 'git config credential.helper store'
    os.system(cmd)

    # clone shells
    cmd = 'git clone https://gitee.com/bode135/shells.git'
    os.system(cmd)

    if not args.move_file:
        return

    print(f'--- 移动部分脚本文件: {args.move_file}')
    filename = 'forceManage.py'
    src = os.path.join(dirname, filename)
    dst = filename
    shutil.move(src, dst)       # shutil.copy2(src, dst)


if __name__ == '__main__':
    print('sys.argv --- ', sys.argv)
    run()

